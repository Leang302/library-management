import '../../models/models.dart';
import '../api_client.dart';

class AuthService {
  const AuthService(this.api);
  final ApiClient api;

  /// [identifier] is an email address or a student id (e.g. `STU-10231`).
  /// [deviceToken] (FCM) + [platform] (`ANDROID` | `IOS` | `WEB`) register this
  /// device for the user's push notifications.
  Future<LoginResult> login(String identifier, String password, {String? deviceToken, String? platform}) async {
    final body = <String, dynamic>{'identifier': identifier, 'password': password};
    if (deviceToken != null && deviceToken.isNotEmpty) {
      body['deviceToken'] = deviceToken;
      if (platform != null) body['platform'] = platform;
    }
    final j = asJson(await api.post('/auth/login', body: body));
    return LoginResult(asString(j['token']), User.fromJson(asJson(j['user'])));
  }

  /// Unregisters [deviceToken] from push. No JWT needed.
  Future<void> logout(String deviceToken) async {
    await api.post('/auth/logout', body: {'deviceToken': deviceToken}, authenticated: false);
  }

  Future<User> me() async => User.fromJson(asJson(await api.get('/auth/me')));
}
