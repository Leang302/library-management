import 'json.dart';
import 'loan.dart';
import 'user.dart';

class RequestStatus {
  RequestStatus._();
  static const pending = 'PENDING_APPROVAL';
  static const approved = 'APPROVED';
  static const rejected = 'REJECTED';
  static const expired = 'EXPIRED';
  static const cancelled = 'CANCELLED';
  static const all = [pending, approved, rejected, expired, cancelled];
}

/// One eligibility / review line.
class Check {
  const Check({required this.key, required this.label, required this.ok, required this.detail});

  final String key;
  final String label;
  final bool ok;
  final String detail;

  factory Check.fromJson(Json j) => Check(
        key: asString(j['key']),
        label: asString(j['label']),
        ok: asBool(j['ok']),
        detail: asString(j['detail']),
      );
}

class Eligibility {
  const Eligibility({
    required this.ok,
    required this.checks,
    required this.errors,
    required this.activeCount,
    required this.overdueCount,
    required this.remaining,
  });

  final bool ok;
  final List<Check> checks;
  final List<String> errors;
  final int activeCount;
  final int overdueCount;
  final int remaining;

  static const empty = Eligibility(ok: false, checks: [], errors: [], activeCount: 0, overdueCount: 0, remaining: 0);

  factory Eligibility.fromJson(Json j) => Eligibility(
        ok: asBool(j['ok']),
        checks: asList(j['checks'], Check.fromJson),
        errors: asStringList(j['errors']),
        activeCount: asInt(j['activeCount']),
        overdueCount: asInt(j['overdueCount']),
        remaining: asInt(j['remaining']),
      );
}

class RequestItem {
  const RequestItem({
    required this.id,
    required this.copyId,
    required this.bookId,
    required this.bookTitle,
    required this.bookAuthor,
    required this.verified,
    required this.swappedFrom,
  });

  final int id;
  final String copyId;
  final int bookId;
  final String bookTitle;
  final String bookAuthor;
  final bool verified;
  final String? swappedFrom;

  factory RequestItem.fromJson(Json j) => RequestItem(
        id: asInt(j['id']),
        copyId: asString(j['copyId']),
        bookId: asInt(j['bookId']),
        bookTitle: asString(j['bookTitle']),
        bookAuthor: asString(j['bookAuthor']),
        verified: asBool(j['verified']),
        swappedFrom: asStringOrNull(j['swappedFrom']),
      );
}

/// A checkout request (the student's QR pass).
class BorrowRequest {
  const BorrowRequest({
    required this.id,
    required this.code,
    required this.qrPayload,
    required this.memberId,
    required this.memberName,
    required this.studentId,
    required this.status,
    required this.requestedAt,
    required this.expiresAt,
    required this.processedAt,
    required this.processedByName,
    required this.rejectReason,
    required this.items,
  });

  final int id;

  /// Short human code, e.g. `CR-8F3K2A`.
  final String code;

  /// `LMS-REQ:<token>` — only filled for the student who owns the request.
  final String? qrPayload;
  final int memberId;
  final String memberName;
  final String studentId;

  /// RequestStatus value.
  final String status;
  final DateTime? requestedAt;
  final DateTime? expiresAt;
  final DateTime? processedAt;
  final String? processedByName;
  final String? rejectReason;
  final List<RequestItem> items;

  bool get isPending => status == RequestStatus.pending;
  bool get isApproved => status == RequestStatus.approved;
  bool get isRejected => status == RequestStatus.rejected;

  factory BorrowRequest.fromJson(Json j) => BorrowRequest(
        id: asInt(j['id']),
        code: asString(j['code']),
        qrPayload: asStringOrNull(j['qrPayload']),
        memberId: asInt(j['memberId']),
        memberName: asString(j['memberName']),
        studentId: asString(j['studentId']),
        status: asString(j['status'], RequestStatus.pending),
        requestedAt: asDate(j['requestedAt']),
        expiresAt: asDate(j['expiresAt']),
        processedAt: asDate(j['processedAt']),
        processedByName: asStringOrNull(j['processedByName']),
        rejectReason: asStringOrNull(j['rejectReason']),
        items: asList(j['items'], RequestItem.fromJson),
      );
}

/// A request item as seen on the librarian review screen (`{ ...item, ok, issue }`).
class ReviewItem {
  const ReviewItem({required this.item, required this.ok, required this.issue});

  final RequestItem item;
  final bool ok;
  final String? issue;

  factory ReviewItem.fromJson(Json j) => ReviewItem(
        item: RequestItem.fromJson(j),
        ok: asBool(j['ok'], true),
        issue: asStringOrNull(j['issue']),
      );
}

/// `GET /requests/{id}/review`
class Review {
  const Review({
    required this.request,
    required this.member,
    required this.checks,
    required this.items,
    required this.ok,
    required this.scanned,
    required this.needScan,
  });

  final BorrowRequest request;
  final Member? member;
  final List<Check> checks;
  final List<ReviewItem> items;
  final bool ok;
  final int scanned;
  final bool needScan;

  int get scanLeft {
    final left = items.length - scanned;
    return left < 0 ? 0 : left;
  }

  factory Review.fromJson(Json j) {
    final m = asJsonOrNull(j['member']);
    return Review(
      request: BorrowRequest.fromJson(asJson(j['request'])),
      member: m == null ? null : Member.fromJson(m),
      checks: asList(j['checks'], Check.fromJson),
      items: asList(j['items'], ReviewItem.fromJson),
      ok: asBool(j['ok']),
      scanned: asInt(j['scanned']),
      needScan: asBool(j['needScan']),
    );
  }
}

/// `POST /requests/{id}/handover`
class HandoverResult {
  const HandoverResult({
    required this.swapped,
    required this.from,
    required this.copyId,
    required this.bookTitle,
    required this.review,
  });

  final bool swapped;
  final String? from;
  final String copyId;
  final String bookTitle;
  final Review review;

  factory HandoverResult.fromJson(Json j) => HandoverResult(
        swapped: asBool(j['swapped']),
        from: asStringOrNull(j['from']),
        copyId: asString(j['copyId']),
        bookTitle: asString(j['bookTitle']),
        review: Review.fromJson(asJson(j['review'])),
      );
}

/// `POST /requests/{id}/approve`
class ApproveResult {
  const ApproveResult({required this.request, required this.loans, required this.dueAt});

  final BorrowRequest request;
  final List<Loan> loans;
  final DateTime? dueAt;

  factory ApproveResult.fromJson(Json j) => ApproveResult(
        request: BorrowRequest.fromJson(asJson(j['request'])),
        loans: asList(j['loans'], Loan.fromJson),
        dueAt: asDate(j['dueAt']),
      );
}
