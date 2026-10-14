import 'book.dart';
import 'json.dart';
import 'request.dart';
import 'user.dart';

class CartItem {
  const CartItem({required this.copyId, required this.book});

  final String copyId;
  final Book book;

  factory CartItem.fromJson(Json j) => CartItem(
        copyId: asString(j['copyId']),
        book: Book.fromJson(asJson(j['book'])),
      );
}

/// `GET /me/cart`
class Cart {
  const Cart({required this.items, required this.eligibility});

  final List<CartItem> items;
  final Eligibility eligibility;

  bool get isEmpty => items.isEmpty;
  bool get canCheckout => items.isNotEmpty && eligibility.ok;
  bool containsBook(int bookId) => items.any((i) => i.book.id == bookId);

  factory Cart.fromJson(Json j) => Cart(
        items: asList(j['items'], CartItem.fromJson),
        eligibility: Eligibility.fromJson(asJson(j['eligibility'])),
      );
}

/// `GET /me/member-card`
class MemberCard {
  const MemberCard({required this.member, required this.qrPayload});

  final Member member;
  final String qrPayload;

  factory MemberCard.fromJson(Json j) => MemberCard(
        member: Member.fromJson(asJson(j['member'])),
        qrPayload: asString(j['qrPayload']),
      );
}
