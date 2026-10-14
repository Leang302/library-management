import '../../models/models.dart';
import '../api_client.dart';

/// `/me/*` endpoints (STUDENT only).
class StudentService {
  const StudentService(this.api);
  final ApiClient api;

  Future<Cart> cart() async => Cart.fromJson(asJson(await api.get('/me/cart')));

  /// Adds a scanned copy (`BOOKCOPY-000004`, `4`, ...) to the cart.
  Future<Cart> addToCart(String code) async => Cart.fromJson(asJson(await api.post('/me/cart', body: {'code': code})));

  /// Adds the first borrowable copy of a title.
  Future<Cart> addBookToCart(int bookId) async => Cart.fromJson(asJson(await api.post('/me/cart/books/$bookId')));

  Future<Cart> removeFromCart(String copyId) async =>
      Cart.fromJson(asJson(await api.delete('/me/cart/${Uri.encodeComponent(copyId)}')));

  Future<BorrowRequest> checkout() async => BorrowRequest.fromJson(asJson(await api.post('/me/checkout')));

  /// The pending checkout request, or null when there is none (no `payload`).
  Future<BorrowRequest?> currentCheckout() async {
    final data = await api.get('/me/checkout/current');
    if (data is! Map) return null;
    return BorrowRequest.fromJson(asJson(data));
  }

  Future<BorrowRequest> checkoutById(int id) async => BorrowRequest.fromJson(asJson(await api.get('/me/checkout/$id')));

  Future<BorrowRequest> refreshCheckout(int id) async =>
      BorrowRequest.fromJson(asJson(await api.post('/me/checkout/$id/refresh')));

  Future<BorrowRequest> cancelCheckout(int id) async =>
      BorrowRequest.fromJson(asJson(await api.post('/me/checkout/$id/cancel')));

  /// [scope] is `current` or `history`.
  Future<List<Loan>> loans({String scope = 'current'}) async =>
      asList(await api.get('/me/loans', query: {'scope': scope}), Loan.fromJson);

  Future<List<Reservation>> reservations() async => asList(await api.get('/me/reservations'), Reservation.fromJson);

  Future<Reservation> reserve(int bookId) async =>
      Reservation.fromJson(asJson(await api.post('/me/reservations', body: {'bookId': bookId})));

  Future<void> cancelReservation(int id) async {
    await api.delete('/me/reservations/$id');
  }

  Future<List<Receipt>> receipts() async => asList(await api.get('/me/receipts'), Receipt.fromJson);

  Future<MemberCard> memberCard() async => MemberCard.fromJson(asJson(await api.get('/me/member-card')));
}
