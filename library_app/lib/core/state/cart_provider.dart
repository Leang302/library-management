import 'package:flutter/foundation.dart';

import '../api/services/student_service.dart';
import '../models/cart.dart';

/// The student's borrow cart, shared so the badge stays in sync everywhere.
class CartProvider extends ChangeNotifier {
  Cart? _cart;

  Cart? get cart => _cart;
  int get count => _cart?.items.length ?? 0;
  Set<String> get copyIds => {...?_cart?.items.map((i) => i.copyId)};

  bool containsBook(int bookId) => _cart?.containsBook(bookId) ?? false;

  void set(Cart cart) {
    _cart = cart;
    notifyListeners();
  }

  void clear() {
    _cart = null;
    notifyListeners();
  }

  /// Reloads silently; errors are ignored (the badge just keeps its last value).
  Future<void> refresh(StudentService service) async {
    try {
      set(await service.cart());
    } catch (_) {
      // ignore - cart badge is best effort
    }
  }
}
