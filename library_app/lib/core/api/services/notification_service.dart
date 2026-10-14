import '../../models/models.dart';
import '../api_client.dart';

class NotificationService {
  const NotificationService(this.api);
  final ApiClient api;

  /// `GET /notifications` (paged, newest first).
  Future<PageResult<AppNotification>> list({int page = 1, int size = 20}) =>
      api.getPage('/notifications', AppNotification.fromJson, page: page, size: size);

  Future<int> unreadCount() async => asInt(asJson(await api.get('/notifications/unread-count'))['count']);

  Future<void> markRead(int id) async {
    await api.post('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await api.post('/notifications/read-all');
  }

  /// (Re)registers this device's FCM token for the signed-in user.
  /// [platform] is `ANDROID`, `IOS` or `WEB`.
  Future<void> registerDevice(String token, String platform) async {
    await api.post('/notifications/devices', body: {'token': token, 'platform': platform});
  }
}
