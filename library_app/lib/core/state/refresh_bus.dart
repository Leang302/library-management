import 'package:flutter/foundation.dart';

/// App-wide "data changed" signal. Screens that show server data listen to it
/// and reload; actions that change data (approve, return, add to cart...) call [bump].
class RefreshBus extends ChangeNotifier {
  void bump() => notifyListeners();
}
