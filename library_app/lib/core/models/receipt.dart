import 'json.dart';

class ReceiptLine {
  const ReceiptLine({
    required this.copyId,
    required this.bookTitle,
    required this.dueAt,
    required this.returnedAt,
    required this.condition,
    required this.daysLate,
  });

  final String copyId;
  final String bookTitle;
  final DateTime? dueAt;
  final DateTime? returnedAt;
  final String? condition;
  final int daysLate;

  factory ReceiptLine.fromJson(Json j) => ReceiptLine(
        copyId: asString(j['copyId']),
        bookTitle: asString(j['bookTitle']),
        dueAt: asDate(j['dueAt']),
        returnedAt: asDate(j['returnedAt']),
        condition: asStringOrNull(j['condition']),
        daysLate: asInt(j['daysLate']),
      );
}

class Receipt {
  const Receipt({
    required this.id,
    required this.type,
    required this.number,
    required this.qrPayload,
    required this.memberId,
    required this.memberName,
    required this.staffName,
    required this.createdAt,
    required this.lines,
  });

  final int id;

  /// e.g. `RETURN`
  final String type;

  /// e.g. `RT-8K2M4Q`
  final String number;

  /// `LMS-RCT:<token>`
  final String? qrPayload;
  final int memberId;
  final String memberName;
  final String staffName;
  final DateTime? createdAt;
  final List<ReceiptLine> lines;

  String get typeLabel {
    switch (type) {
      case 'RETURN':
        return 'Return receipt';
      case 'CHECKOUT':
      case 'LOAN':
        return 'Loan receipt';
      default:
        final t = type.toLowerCase().replaceAll('_', ' ');
        return t.isEmpty ? 'Receipt' : '${t[0].toUpperCase()}${t.substring(1)} receipt';
    }
  }

  factory Receipt.fromJson(Json j) => Receipt(
        id: asInt(j['id']),
        type: asString(j['type'], 'RETURN'),
        number: asString(j['number']),
        qrPayload: asStringOrNull(j['qrPayload']),
        memberId: asInt(j['memberId']),
        memberName: asString(j['memberName']),
        staffName: asString(j['staffName']),
        createdAt: asDate(j['createdAt']),
        lines: asList(j['lines'], ReceiptLine.fromJson),
      );
}
