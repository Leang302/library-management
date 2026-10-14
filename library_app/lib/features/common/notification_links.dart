import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/receipt.dart';
import '../../core/state/auth_provider.dart';
import '../../core/state/shell_controller.dart';
import '../librarian/book_manage_screen.dart';
import '../librarian/request_review_screen.dart';
import '../student/book_detail_screen.dart';
import 'notifications_screen.dart';
import 'receipt_view.dart';

/// Opens the screen a notification points at (`linkTo` / `linkId`), both for
/// tapped pushes and for items in the Notifications screen.
///
/// Known targets: `mybooks`, `receipt` (receipt id), `requestReview` (request id),
/// `bookDetail` (book id). Anything else opens the Notifications screen when
/// [fallbackToList] is true (pushes), or does nothing (the list itself).
///
/// [nav] must sit below the app's providers (the root navigator does).
Future<void> openNotificationLink(
  NavigatorState nav, {
  String? linkTo,
  String? linkId,
  bool fallbackToList = true,
}) async {
  final ctx = nav.context;
  final user = ctx.read<AuthProvider>().user;
  if (user == null) return;
  final shell = ctx.read<ShellController>();
  final api = ctx.read<ApiClient>();
  final id = int.tryParse(linkId ?? '');

  void push(Widget screen) => nav.push(MaterialPageRoute<void>(builder: (_) => screen));

  void openMyBooks([int tabIndex = 0]) {
    nav.popUntil((route) => route.isFirst);
    shell.openMyBooks(tabIndex: tabIndex);
  }

  switch (linkTo) {
    case 'mybooks':
      if (user.isStudent) {
        openMyBooks();
        return;
      }
      break;
    case 'receipt':
      if (user.isStudent) {
        if (id != null) {
          Receipt? found;
          try {
            for (final r in await StudentService(api).receipts()) {
              if (r.id == id) {
                found = r;
                break;
              }
            }
          } catch (_) {
            // Fall back to the receipts tab below.
          }
          if (!nav.mounted) return;
          if (found != null) {
            push(ReceiptDetailScreen(receipt: found));
            return;
          }
        }
        openMyBooks(3); // Receipts tab
        return;
      }
      break;
    case 'requestReview':
      if (user.isStaff && id != null) {
        push(RequestReviewScreen(requestId: id));
        return;
      }
      if (user.isStudent) {
        openMyBooks();
        return;
      }
      break;
    case 'bookDetail':
      if (id != null) {
        push(user.isStaff ? BookManageScreen(bookId: id) : BookDetailScreen(bookId: id));
        return;
      }
      break;
  }
  if (fallbackToList) push(const NotificationsScreen());
}
