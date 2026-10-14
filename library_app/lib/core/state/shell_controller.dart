import 'package:flutter/foundation.dart';

/// Tab identifiers used by the role shell.
class AppTab {
  AppTab._();
  static const home = 'home';
  static const explore = 'explore';
  static const myBooks = 'mybooks';
  static const dashboard = 'dashboard';
  static const requests = 'requests';
  static const books = 'books';
  static const manage = 'manage';
  static const profile = 'profile';
}

/// Which bottom-navigation tab is selected, plus one-shot hand-offs between tabs
/// (e.g. tapping a category on Home opens Explore filtered by it).
class ShellController extends ChangeNotifier {
  String? _tab;
  String? _exploreCategory;
  String? _exploreQuery;
  int? _myBooksTab;

  /// Null means "the role's first tab".
  String? get tab => _tab;

  void select(String tab) {
    if (_tab == tab) return;
    _tab = tab;
    notifyListeners();
  }

  /// Back to the first tab without notifying (used when a new shell mounts).
  void resetSilently() {
    _tab = null;
    _exploreCategory = null;
    _exploreQuery = null;
    _myBooksTab = null;
  }

  void openExplore({String? category, String? query}) {
    _exploreCategory = category;
    _exploreQuery = query;
    _tab = AppTab.explore;
    notifyListeners();
  }

  void openMyBooks({int tabIndex = 0}) {
    _myBooksTab = tabIndex;
    _tab = AppTab.myBooks;
    notifyListeners();
  }

  /// Returns and clears the pending Explore filter, if any.
  ({String? category, String? query})? takeExploreRequest() {
    if (_exploreCategory == null && _exploreQuery == null) return null;
    final r = (category: _exploreCategory, query: _exploreQuery);
    _exploreCategory = null;
    _exploreQuery = null;
    return r;
  }

  /// Returns and clears the requested My Books sub-tab (null = no request).
  int? takeMyBooksTab() {
    final t = _myBooksTab;
    _myBooksTab = null;
    return t;
  }
}
