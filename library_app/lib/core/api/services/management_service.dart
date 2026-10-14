import '../../models/models.dart';
import '../api_client.dart';

/// Library management endpoints: users, policies, reports, audit log (LIBRARIAN).
class ManagementService {
  const ManagementService(this.api);
  final ApiClient api;

  /// `GET /users` (paged).
  Future<PageResult<User>> users({String? role, String? q, String direction = 'ASC', int page = 1, int size = 20}) =>
      api.getPage('/users', User.fromJson, page: page, size: size, query: {'role': role, 'q': q, 'direction': direction});

  /// Body: `{ name, email, password, role, phone, title, studentId, program, year }`.
  Future<User> createUser(Map<String, dynamic> body) async => User.fromJson(asJson(await api.post('/users', body: body)));

  /// Body: `{ name, email, phone, title, role, active, password? }`.
  Future<User> updateUser(int id, Map<String, dynamic> body) async =>
      User.fromJson(asJson(await api.put('/users/$id', body: body)));

  Future<void> deleteUser(int id) async {
    await api.delete('/users/$id');
  }

  Future<LibrarySettings> settings() async => LibrarySettings.fromJson(asJson(await api.get('/settings')));

  Future<LibrarySettings> saveSettings(LibrarySettings s) async =>
      LibrarySettings.fromJson(asJson(await api.put('/settings', body: s.toJson())));

  Future<Reports> dashboard({int days = 30}) async =>
      Reports.fromJson(asJson(await api.get('/dashboard/reports', query: {'days': days})));

  /// `GET /audit-logs` (paged, newest first).
  Future<PageResult<AuditLog>> auditLogs({int page = 1, int size = 20}) =>
      api.getPage('/audit-logs', AuditLog.fromJson, page: page, size: size);
}
