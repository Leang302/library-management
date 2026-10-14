import 'json.dart';

class LoanStatus {
  LoanStatus._();
  static const active = 'ACTIVE';
  static const overdue = 'OVERDUE';
  static const returned = 'RETURNED';
}

/// A borrow transaction.
class Loan {
  const Loan({
    required this.id,
    required this.requestId,
    required this.copyId,
    required this.bookId,
    required this.bookTitle,
    required this.bookAuthor,
    required this.memberId,
    required this.memberName,
    required this.studentId,
    required this.borrowedAt,
    required this.dueAt,
    required this.returnedAt,
    required this.status,
    required this.condition,
    required this.daysLate,
  });

  final int id;
  final int? requestId;
  final String copyId;
  final int bookId;
  final String bookTitle;
  final String bookAuthor;
  final int memberId;
  final String memberName;
  final String studentId;
  final DateTime? borrowedAt;
  final DateTime? dueAt;
  final DateTime? returnedAt;

  /// LoanStatus value.
  final String status;
  final String? condition;
  final int daysLate;

  bool get isReturned => status == LoanStatus.returned;
  bool get isOverdue => status == LoanStatus.overdue;
  bool get returnedLate => isReturned && daysLate > 0;

  factory Loan.fromJson(Json j) => Loan(
        id: asInt(j['id']),
        requestId: asIntOrNull(j['requestId']),
        copyId: asString(j['copyId']),
        bookId: asInt(j['bookId']),
        bookTitle: asString(j['bookTitle']),
        bookAuthor: asString(j['bookAuthor']),
        memberId: asInt(j['memberId']),
        memberName: asString(j['memberName']),
        studentId: asString(j['studentId']),
        borrowedAt: asDate(j['borrowedAt']),
        dueAt: asDate(j['dueAt']),
        returnedAt: asDate(j['returnedAt']),
        status: asString(j['status'], LoanStatus.active),
        condition: asStringOrNull(j['condition']),
        daysLate: asInt(j['daysLate']),
      );
}
