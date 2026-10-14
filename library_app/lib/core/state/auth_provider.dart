import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/services/auth_service.dart';
import '../api/services/notification_service.dart';
import '../models/user.dart';
import '../push/push_service.dart';

enum AuthStatus { loading, signedOut, signedIn }

/// Holds the signed-in user, persists the JWT and the server URL, and binds
/// this device's push token to the signed-in user (and unbinds it on sign-out).
class AuthProvider extends ChangeNotifier {
  AuthProvider(this.api, {PushService? push}) : push = push ?? PushService.instance {
    api.onUnauthorized = _handleUnauthorized;
    this.push.onTokenRefresh = _onPushTokenRefresh;
  }

  static const _kToken = 'auth_token';
  static const _kServerUrl = 'server_url';

  /// FCM token whose server-side unregister failed (signed out while offline);
  /// retried on the next start.
  static const _kPendingLogoutToken = 'push_pending_logout_token';

  final ApiClient api;
  final PushService push;

  AuthStatus _status = AuthStatus.loading;
  User? _user;
  String? _startupMessage;
  bool _loggingOut = false;

  AuthStatus get status => _status;
  User? get user => _user;
  String get serverUrl => api.baseUrl;

  /// Set when a saved session could not be restored (e.g. server unreachable).
  String? get startupMessage => _startupMessage;

  /// Android emulators reach the host machine through 10.0.2.2.
  static String defaultServerUrl() {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:8081/api/v1';
    return 'http://localhost:8081/api/v1';
  }

  /// Saved URLs from before the `/api/v1` base path end with `/api`.
  static String migrateServerUrl(String url) {
    final s = ApiClient.normalizeBaseUrl(url);
    return s.endsWith('/api') ? '$s/v1' : s;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kServerUrl);
    if (saved != null) {
      final migrated = migrateServerUrl(saved);
      if (migrated != saved) await prefs.setString(_kServerUrl, migrated);
      api.baseUrl = migrated;
    } else {
      api.baseUrl = defaultServerUrl();
    }

    final token = prefs.getString(_kToken);
    if (token == null || token.isEmpty) {
      _setStatus(AuthStatus.signedOut);
      unawaited(_retryPendingPushLogout());
      return;
    }
    api.token = token;
    try {
      _user = await AuthService(api).me();
      _startupMessage = null;
      push.signedIn = true;
      _setStatus(AuthStatus.signedIn);
      // The token may have rotated while the app was closed.
      unawaited(_registerPushDevice());
    } on ApiException catch (e) {
      api.token = null;
      if (e.status == 401 || e.status == 403) {
        await prefs.remove(_kToken);
        _startupMessage = 'Your session has expired. Please sign in again.';
      } else {
        // Keep the saved token so the next attempt can restore the session.
        _startupMessage = e.message;
      }
      _user = null;
      _setStatus(AuthStatus.signedOut);
    } catch (_) {
      api.token = null;
      _user = null;
      _setStatus(AuthStatus.signedOut);
    }
  }

  Future<void> login(String identifier, String password) async {
    // Sending the FCM token binds this device to the user signing in (and
    // unbinds it from whoever used it before). Null = no push on this device.
    final deviceToken = await push.token();
    final result = await AuthService(api).login(
      identifier.trim(),
      password,
      deviceToken: deviceToken,
      platform: PushService.platformName,
    );
    api.token = result.token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken, result.token);
    if (deviceToken != null) await prefs.remove(_kPendingLogoutToken);
    _user = result.user;
    _startupMessage = null;
    push.signedIn = true;
    _setStatus(AuthStatus.signedIn);
  }

  Future<void> refreshUser() async {
    if (_status != AuthStatus.signedIn) return;
    _user = await AuthService(api).me();
    notifyListeners();
  }

  /// Signs out. Works offline: the server call and token deletion are best
  /// effort, the local session is always cleared.
  Future<void> logout({String? message}) async {
    if (_loggingOut) return;
    _loggingOut = true;
    push.signedIn = false;
    SharedPreferences? prefs;
    try {
      final p = await SharedPreferences.getInstance();
      prefs = p;
      if (push.isAvailable) {
        final deviceToken = await push.token();
        if (deviceToken != null) {
          var unregistered = false;
          try {
            await AuthService(api).logout(deviceToken).timeout(const Duration(seconds: 5));
            unregistered = true;
          } catch (_) {
            // Offline / server error - retried on next start.
          }
          if (unregistered) {
            await p.remove(_kPendingLogoutToken);
          } else {
            await p.setString(_kPendingLogoutToken, deviceToken);
          }
        }
        // Kill the token so nothing addressed to it is delivered any more;
        // the next sign-in gets a fresh one.
        await push.deleteToken();
        // Never leave the previous user's notifications on screen.
        await push.clearDisplayed();
        push.discardPendingOpen();
      }
    } catch (e) {
      debugPrint('Sign-out: push cleanup failed ($e).');
    } finally {
      // Whatever failed above, the local session is gone.
      try {
        await (prefs ?? await SharedPreferences.getInstance()).remove(_kToken);
      } catch (_) {
        // Nothing else we can do; the in-memory session is cleared below.
      }
      api.token = null;
      _user = null;
      _startupMessage = message;
      _loggingOut = false;
      _setStatus(AuthStatus.signedOut);
    }
  }

  Future<void> setServerUrl(String url) async {
    api.baseUrl = migrateServerUrl(url);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrl, api.baseUrl);
    notifyListeners();
  }

  Future<void> resetServerUrl() async {
    api.baseUrl = defaultServerUrl();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kServerUrl);
    notifyListeners();
  }

  /// (Re)registers this device's current FCM token for the signed-in user.
  Future<void> _registerPushDevice([String? token]) async {
    if (_status != AuthStatus.signedIn || !push.isAvailable) return;
    final t = token ?? await push.token();
    if (t == null || _status != AuthStatus.signedIn) return;
    try {
      await NotificationService(api).registerDevice(t, PushService.platformName);
    } catch (e) {
      debugPrint('Push notifications: device registration failed ($e).');
    }
  }

  void _onPushTokenRefresh(String token) {
    if (_status == AuthStatus.signedIn) unawaited(_registerPushDevice(token));
  }

  /// A sign-out that couldn't reach the server left the token bound to the old
  /// user; unbind it now (signed out, so nobody should get pushes here).
  Future<void> _retryPendingPushLogout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pending = prefs.getString(_kPendingLogoutToken);
      if (pending == null || pending.isEmpty || _status != AuthStatus.signedOut) return;
      await AuthService(api).logout(pending).timeout(const Duration(seconds: 6));
      await prefs.remove(_kPendingLogoutToken);
    } catch (_) {
      // Still offline - try again next time.
    }
  }

  void _handleUnauthorized() {
    if (_status == AuthStatus.signedIn) {
      logout(message: 'Your session has expired. Please sign in again.');
    }
  }

  void _setStatus(AuthStatus s) {
    _status = s;
    notifyListeners();
  }
}
