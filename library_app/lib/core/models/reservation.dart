import 'json.dart';

class ReservationStatus {
  ReservationStatus._();
  static const waiting = 'WAITING';
  static const ready = 'READY';
  static const fulfilled = 'FULFILLED';
  static const cancelled = 'CANCELLED';
  static const expired = 'EXPIRED';
}

class Reservation {
  const Reservation({
    required this.id,
    required this.bookId,
    required this.bookTitle,
    required this.memberId,
    required this.memberName,
    required this.status,
    required this.position,
    required this.copyId,
    required this.readyAt,
    required this.holdUntil,
    required this.createdAt,
  });

  final int id;
  final int bookId;
  final String bookTitle;
  final int memberId;
  final String memberName;

  /// ReservationStatus value.
  final String status;
  final int position;
  final String? copyId;
  final DateTime? readyAt;
  final DateTime? holdUntil;
  final DateTime? createdAt;

  bool get isWaiting => status == ReservationStatus.waiting;
  bool get isReady => status == ReservationStatus.ready;
  bool get isLive => isWaiting || isReady;

  factory Reservation.fromJson(Json j) => Reservation(
        id: asInt(j['id']),
        bookId: asInt(j['bookId']),
        bookTitle: asString(j['bookTitle']),
        memberId: asInt(j['memberId']),
        memberName: asString(j['memberName']),
        status: asString(j['status'], ReservationStatus.waiting),
        position: asInt(j['position']),
        copyId: asStringOrNull(j['copyId']),
        readyAt: asDate(j['readyAt']),
        holdUntil: asDate(j['holdUntil']),
        createdAt: asDate(j['createdAt']),
      );
}
