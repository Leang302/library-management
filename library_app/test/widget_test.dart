import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/core/models/models.dart';
import 'package:library_app/core/utils/format.dart';

void main() {
  test('plural and enum labels', () {
    expect(Fmt.plural(1, 'book'), '1 book');
    expect(Fmt.plural(3, 'book'), '3 books');
    expect(Fmt.plural(2, 'copy', 'copies'), '2 copies');
    expect(Fmt.enumLabel('PENDING_APPROVAL'), 'Pending approval');
    expect(Fmt.initials('Alex Morgan'), 'AM');
  });

  test('due labels', () {
    final now = DateTime.now();
    expect(Fmt.dueLabel(now), 'Due today');
    expect(Fmt.dueLabel(now.add(const Duration(days: 1))), 'Due tomorrow');
    expect(Fmt.dueLabel(now.subtract(const Duration(days: 2))), '2 days overdue');
  });

  test('BorrowRequest.fromJson', () {
    final r = BorrowRequest.fromJson({
      'id': 4,
      'code': 'CR-8F3K2A',
      'qrPayload': 'LMS-REQ:abc',
      'memberId': 3,
      'memberName': 'Alex Morgan',
      'studentId': 'STU-10231',
      'status': 'PENDING_APPROVAL',
      'requestedAt': '2026-10-14T09:30:00Z',
      'expiresAt': '2026-10-14T09:40:00Z',
      'items': [
        {'id': 7, 'copyId': 'BOOKCOPY-000001', 'bookId': 1, 'bookTitle': 'Atomic Habits', 'bookAuthor': 'James Clear', 'verified': false},
      ],
    });
    expect(r.isPending, isTrue);
    expect(r.items.single.copyId, 'BOOKCOPY-000001');
    expect(r.expiresAt, isNotNull);
  });
}
