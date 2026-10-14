import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/core/api/api_client.dart';
import 'package:library_app/core/models/models.dart';
import 'package:library_app/core/state/auth_provider.dart';

void main() {
  test('unwrapPayload returns payload, or null for an envelope without one', () {
    expect(
      ApiClient.unwrapPayload({'message': 'ok', 'status': 'OK', 'code': 200, 'payload': {'count': 3}}),
      {'count': 3},
    );
    expect(ApiClient.unwrapPayload({'message': 'Deleted', 'status': 'OK', 'code': 200, 'localDateTime': 'x'}), isNull);
    expect(ApiClient.unwrapPayload([1, 2]), [1, 2]);
  });

  test('PageResult.fromEnvelope reads items and paging fields', () {
    final page = PageResult<AppNotification>.fromEnvelope({
      'message': 'ok',
      'status': 'OK',
      'code': 200,
      'payload': [
        {'id': 1, 'type': 'CHECKOUT_APPROVED', 'title': 'Checkout approved', 'body': '', 'linkTo': 'mybooks', 'read': false},
      ],
      'page': 1,
      'size': 20,
      'totalElements': 25,
      'totalPages': 2,
      'hasNext': true,
    }, AppNotification.fromJson);
    expect(page.items.single.linkTo, 'mybooks');
    expect(page.totalElements, 25);
    expect(page.hasNext, isTrue);
  });

  test('old saved server URLs are moved to /api/v1', () {
    expect(AuthProvider.migrateServerUrl('http://10.0.2.2:8081/api'), 'http://10.0.2.2:8081/api/v1');
    expect(AuthProvider.migrateServerUrl('http://10.0.2.2:8081/api/'), 'http://10.0.2.2:8081/api/v1');
    expect(AuthProvider.migrateServerUrl('http://10.0.2.2:8081/api/v1'), 'http://10.0.2.2:8081/api/v1');
  });
}
