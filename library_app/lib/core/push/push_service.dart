import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Background / terminated-state FCM handler. Notification messages are shown
/// in the system tray by the OS, so nothing has to be done here; it only has
/// to exist (and be a top-level, entry-point function) for FCM to deliver.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Already initialised or not configured - nothing else to do.
  }
}

/// Firebase Cloud Messaging + local notifications.
///
/// Targeting (which user gets which push) is done by the backend: the FCM token
/// is sent at login (`deviceToken`), unregistered at logout (`POST /auth/logout`)
/// and then deleted on the device ([deleteToken]) so it can never be used again.
/// A new token is issued for the next user who signs in on this phone.
///
/// If Firebase is not configured (no google-services.json /
/// GoogleService-Info.plist) [init] fails quietly, [isAvailable] stays false
/// and every method is a no-op: the app works normally, just without push.
class PushService {
  PushService._();

  static final PushService instance = PushService._();

  /// The Android channel the backend targets (`android.notification.channel_id`).
  static const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'library_default',
    'Library',
    description: 'Checkout, return, reservation and due-date updates',
    importance: Importance.high,
  );

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  bool _available = false;
  bool _initialised = false;
  bool _permissionAsked = false;

  /// True when Firebase initialised and push can be used.
  bool get isAvailable => _available;

  /// Set by the auth layer. Foreground pushes are ignored while signed out.
  bool signedIn = false;

  /// Called for every push received while the app is in the foreground
  /// (after it was shown), e.g. to refresh badges / lists.
  void Function(RemoteMessage message)? onForegroundMessage;

  /// Called with the new token when FCM rotates it.
  void Function(String token)? onTokenRefresh;

  void Function(Map<String, dynamic> data)? _openHandler;
  Map<String, dynamic>? _pendingOpen;

  /// `ANDROID`, `IOS` or `WEB` - the `platform` value the API expects.
  static String get platformName {
    if (kIsWeb) return 'WEB';
    if (defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS) return 'IOS';
    return 'ANDROID';
  }

  bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<void> init() async {
    if (_initialised) return;
    _initialised = true;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Push notifications disabled: Firebase is not configured ($e).');
      _available = false;
      return;
    }
    _available = true;

    try {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      await _initLocalNotifications();

      final messaging = FirebaseMessaging.instance;
      // iOS: we don't draw our own banner there, so let the OS show it in the foreground.
      await messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessage.listen(_onForeground);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleOpen(m.data));
      messaging.onTokenRefresh.listen((t) => onTokenRefresh?.call(t));

      // App launched by tapping a push while it was terminated.
      final initial = await messaging.getInitialMessage();
      if (initial != null) _handleOpen(initial.data);
    } catch (e) {
      debugPrint('Push notifications: setup failed ($e).');
    }
  }

  Future<void> _initLocalNotifications() async {
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _local.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) => _handleOpen(_decode(response.payload)),
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // App launched by tapping one of our local notifications.
    final launch = await _local.getNotificationAppLaunchDetails();
    if (launch != null && launch.didNotificationLaunchApp) {
      _handleOpen(_decode(launch.notificationResponse?.payload));
    }
  }

  static Map<String, dynamic> _decode(String? payload) {
    if (payload == null || payload.isEmpty) return <String, dynamic>{};
    try {
      final v = jsonDecode(payload);
      return v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  /// Asks for notification permission once (iOS, Android 13+).
  Future<void> requestPermission() async {
    if (!_available || _permissionAsked) return;
    _permissionAsked = true;
    try {
      await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
    } catch (e) {
      debugPrint('Push notifications: permission request failed ($e).');
    }
  }

  /// This device's FCM token, or null when push is unavailable / the token
  /// can't be fetched (offline, APNs not ready, permission denied...).
  Future<String?> token() async {
    if (!_available) return null;
    try {
      await requestPermission();
      final messaging = FirebaseMessaging.instance;
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        // getToken() fails on iOS until the APNs token is known.
        var apns = await messaging.getAPNSToken();
        if (apns == null) {
          await Future<void>.delayed(const Duration(seconds: 2));
          apns = await messaging.getAPNSToken();
        }
        if (apns == null) return null;
      }
      final t = await messaging.getToken().timeout(const Duration(seconds: 8));
      return (t == null || t.isEmpty) ? null : t;
    } catch (e) {
      debugPrint('Push notifications: could not get token ($e).');
      return null;
    }
  }

  /// Invalidates the current FCM token so nothing sent to it is delivered.
  Future<void> deleteToken() async {
    if (!_available) return;
    try {
      await FirebaseMessaging.instance.deleteToken().timeout(const Duration(seconds: 5));
    } catch (e) {
      debugPrint('Push notifications: could not delete token ($e).');
    }
  }

  /// Removes every notification this app has shown (tray + pending).
  Future<void> clearDisplayed() async {
    if (!_available) return;
    try {
      await _local.cancelAll();
    } catch (_) {
      // Best effort.
    }
  }

  Future<void> _onForeground(RemoteMessage message) async {
    // Never show anything while signed out (it can't be for the current user).
    if (!signedIn) return;
    if (_isAndroid) {
      final title = message.notification?.title ?? _str(message.data['title']);
      final body = message.notification?.body ?? _str(message.data['body']);
      if (title != null || body != null) {
        try {
          await _local.show(
            _notificationId(message),
            title,
            body,
            NotificationDetails(
              android: AndroidNotificationDetails(
                channel.id,
                channel.name,
                channelDescription: channel.description,
                importance: Importance.high,
                priority: Priority.high,
              ),
            ),
            payload: jsonEncode(message.data),
          );
        } catch (e) {
          debugPrint('Push notifications: could not show notification ($e).');
        }
      }
    }
    onForegroundMessage?.call(message);
  }

  static String? _str(dynamic v) => v == null ? null : v.toString();

  static int _notificationId(RemoteMessage m) {
    final id = int.tryParse(m.data['notificationId']?.toString() ?? '');
    return (id ?? m.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch) & 0x7fffffff;
  }

  // ---- taps -------------------------------------------------------------

  /// Receives the data of a tapped push. Taps that arrive before a handler is
  /// set (cold start) are kept until [setOpenHandler] / [flushPendingOpen].
  void setOpenHandler(void Function(Map<String, dynamic> data)? handler) {
    _openHandler = handler;
  }

  void _handleOpen(Map<String, dynamic> data) {
    final handler = _openHandler;
    if (handler == null) {
      _pendingOpen = data;
    } else {
      handler(data);
    }
  }

  /// Keeps [data] to be opened later (e.g. while the session is being restored).
  void deferOpen(Map<String, dynamic> data) => _pendingOpen = data;

  /// Delivers a kept tap to the handler, if any.
  void flushPendingOpen() {
    final data = _pendingOpen;
    final handler = _openHandler;
    if (data == null || handler == null) return;
    _pendingOpen = null;
    handler(data);
  }

  /// Drops a kept tap (e.g. after sign-out - it was for the previous user).
  void discardPendingOpen() => _pendingOpen = null;
}
