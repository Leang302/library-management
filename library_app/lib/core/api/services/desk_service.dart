import '../../models/models.dart';
import '../api_client.dart';

/// Librarian desk endpoints (LIBRARIAN).
class DeskService {
  const DeskService(this.api);
  final ApiClient api;

  Future<ScanResolution> resolve(String code) async =>
      ScanResolution.fromJson(asJson(await api.post('/scan/resolve', body: {'code': code})));

  Future<LibrarianDashboard> dashboard() async =>
      LibrarianDashboard.fromJson(asJson(await api.get('/dashboard/librarian')));

  /// `GET /requests` (paged). [direction] `ASC` = oldest first.
  Future<PageResult<BorrowRequest>> requests({
    String? status = RequestStatus.pending,
    String direction = 'DESC',
    int page = 1,
    int size = ApiClient.maxPageSize,
  }) =>
      api.getPage('/requests', BorrowRequest.fromJson,
          page: page, size: size, query: {'status': status, 'direction': direction});

  Future<Review> review(int id) async => Review.fromJson(asJson(await api.get('/requests/$id/review')));

  Future<HandoverResult> handover(int id, String code) async =>
      HandoverResult.fromJson(asJson(await api.post('/requests/$id/handover', body: {'code': code})));

  Future<ApproveResult> approve(int id) async =>
      ApproveResult.fromJson(asJson(await api.post('/requests/$id/approve')));

  Future<BorrowRequest> reject(int id, String reason) async =>
      BorrowRequest.fromJson(asJson(await api.post('/requests/$id/reject', body: {'reason': reason})));

  Future<ReturnPreview> returnPreview(String code) async =>
      ReturnPreview.fromJson(asJson(await api.get('/returns/preview', query: {'code': code})));

  Future<ReturnResult> processReturn({
    required String code,
    required String condition,
    String note = '',
    int? receiptId,
  }) async {
    final data = await api.post('/returns', body: {
      'code': code,
      'condition': condition,
      'note': note,
      'receiptId': receiptId,
    });
    return ReturnResult.fromJson(asJson(data));
  }

  /// [status] is `ALL`, `ACTIVE`, `OVERDUE` or `RETURNED`.
  Future<PageResult<Loan>> loans({String status = 'ALL', String? q, String direction = 'DESC', int page = 1, int size = 20}) =>
      api.getPage('/loans', Loan.fromJson, page: page, size: size, query: {'status': status, 'q': q, 'direction': direction});

  Future<BookCopy> copy(String copyId) async =>
      BookCopy.fromJson(asJson(await api.get('/copies/${Uri.encodeComponent(copyId)}')));

  Future<BookCopy> setCopyStatus(String copyId, String status, {String note = ''}) async {
    final data = await api.patch('/copies/${Uri.encodeComponent(copyId)}/status', body: {'status': status, 'note': note});
    return BookCopy.fromJson(asJson(data));
  }

  /// `GET /members` (paged, sorted by name).
  Future<PageResult<Member>> members({String? q, String direction = 'ASC', int page = 1, int size = 20}) =>
      api.getPage('/members', Member.fromJson, page: page, size: size, query: {'q': q, 'direction': direction});

  Future<MemberDetail> member(int id) async => MemberDetail.fromJson(asJson(await api.get('/members/$id')));

  Future<Member> setMemberStatus(int id, String status) async =>
      Member.fromJson(asJson(await api.patch('/members/$id/status', body: {'status': status})));

  Future<Member> renewMember(int id) async => Member.fromJson(asJson(await api.post('/members/$id/renew')));

  Future<Receipt> verifyReceipt(String code) async =>
      Receipt.fromJson(asJson(await api.get('/receipts/verify', query: {'code': code})));

  /// `GET /reservations` (paged).
  Future<PageResult<Reservation>> reservations({String? status = ReservationStatus.waiting, int page = 1, int size = 20}) =>
      api.getPage('/reservations', Reservation.fromJson, page: page, size: size, query: {'status': status});
}
