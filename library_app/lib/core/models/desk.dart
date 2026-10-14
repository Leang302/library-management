import 'book.dart';
import 'json.dart';
import 'loan.dart';
import 'receipt.dart';
import 'request.dart';
import 'reservation.dart';
import 'user.dart';

class ScanType {
  ScanType._();
  static const copy = 'COPY';
  static const request = 'REQUEST';
  static const member = 'MEMBER';
  static const receipt = 'RECEIPT';
  static const unknown = 'UNKNOWN';
}

/// `POST /scan/resolve`
class ScanResolution {
  const ScanResolution({required this.type, required this.id, required this.label, required this.suggestedAction});

  /// ScanType value.
  final String type;

  /// Numeric id as a string ("4") or a copy id ("BOOKCOPY-000004").
  final String? id;
  final String label;

  /// `REVIEW_REQUEST` | `RETURN` | `COPY_INFO` | `MEMBER` | `RECEIPT` | null
  final String? suggestedAction;

  int? get intId => id == null ? null : int.tryParse(id!);

  factory ScanResolution.fromJson(Json j) => ScanResolution(
        type: asString(j['type'], ScanType.unknown),
        id: asStringOrNull(j['id']),
        label: asString(j['label']),
        suggestedAction: asStringOrNull(j['suggestedAction']),
      );
}

class DayStat {
  const DayStat({required this.label, required this.borrowed, required this.returned});

  final String label;
  final int borrowed;
  final int returned;

  factory DayStat.fromJson(Json j) => DayStat(
        label: asString(j['label']),
        borrowed: asInt(j['borrowed']),
        returned: asInt(j['returned']),
      );
}

/// `GET /dashboard/librarian`
class LibrarianDashboard {
  const LibrarianDashboard({
    required this.borrowedToday,
    required this.returnedToday,
    required this.pending,
    required this.overdue,
    required this.activeMembers,
    required this.availableCopies,
    required this.dueToday,
    required this.pendingRequests,
    required this.last7,
  });

  final int borrowedToday;
  final int returnedToday;
  final int pending;
  final int overdue;
  final int activeMembers;
  final int availableCopies;
  final List<Loan> dueToday;
  final List<BorrowRequest> pendingRequests;
  final List<DayStat> last7;

  factory LibrarianDashboard.fromJson(Json j) => LibrarianDashboard(
        borrowedToday: asInt(j['borrowedToday']),
        returnedToday: asInt(j['returnedToday']),
        pending: asInt(j['pending']),
        overdue: asInt(j['overdue']),
        activeMembers: asInt(j['activeMembers']),
        availableCopies: asInt(j['availableCopies']),
        dueToday: asList(j['dueToday'], Loan.fromJson),
        pendingRequests: asList(j['pendingRequests'], BorrowRequest.fromJson),
        last7: asList(j['last7'], DayStat.fromJson),
      );
}

/// `GET /returns/preview`
class ReturnPreview {
  const ReturnPreview({required this.copy, required this.book, required this.loan, required this.member});

  final BookCopy copy;
  final Book? book;
  final Loan? loan;
  final Member? member;

  factory ReturnPreview.fromJson(Json j) {
    final b = asJsonOrNull(j['book']);
    final l = asJsonOrNull(j['loan']);
    final m = asJsonOrNull(j['member']);
    return ReturnPreview(
      copy: BookCopy.fromJson(asJson(j['copy'])),
      book: b == null ? null : Book.fromJson(b),
      loan: l == null ? null : Loan.fromJson(l),
      member: m == null ? null : Member.fromJson(m),
    );
  }
}

/// `POST /returns`
class ReturnResult {
  const ReturnResult({required this.loan, required this.copyStatus, required this.heldForName, required this.receipt});

  final Loan loan;
  final String copyStatus;
  final String? heldForName;
  final Receipt? receipt;

  factory ReturnResult.fromJson(Json j) {
    final r = asJsonOrNull(j['receipt']);
    return ReturnResult(
      loan: Loan.fromJson(asJson(j['loan'])),
      copyStatus: asString(j['copyStatus'], CopyStatus.available),
      heldForName: asStringOrNull(j['heldForName']),
      receipt: r == null ? null : Receipt.fromJson(r),
    );
  }
}

/// `GET /members/{id}`
class MemberDetail {
  const MemberDetail({required this.member, required this.loans, required this.reservations, required this.eligibility});

  final Member member;
  final List<Loan> loans;
  final List<Reservation> reservations;
  final Eligibility eligibility;

  factory MemberDetail.fromJson(Json j) => MemberDetail(
        member: Member.fromJson(asJson(j['member'])),
        loans: asList(j['loans'], Loan.fromJson),
        reservations: asList(j['reservations'], Reservation.fromJson),
        eligibility: Eligibility.fromJson(asJson(j['eligibility'])),
      );
}
