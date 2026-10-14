import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/check_list.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import 'checkout_qr_screen.dart';
import 'student_scan_screen.dart';

class _CartData {
  const _CartData(this.cart, this.pending);
  final Cart cart;
  final BorrowRequest? pending;
}

/// Borrow cart: items, eligibility checks and "Generate Checkout QR".
class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> with Loader<CartScreen, _CartData> {
  late final StudentService _student = context.studentApi;
  late final CartProvider _cartProvider = context.read<CartProvider>();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<_CartData> fetch() async {
    final r = await Future.wait<dynamic>([_student.cart(), _student.currentCheckout()]);
    final cart = r[0] as Cart;
    _cartProvider.set(cart);
    return _CartData(cart, r[1] as BorrowRequest?);
  }

  void _setCart(Cart cart) {
    _cartProvider.set(cart);
    setState(() => data = _CartData(cart, data?.pending));
  }

  Future<void> _remove(CartItem item) async {
    try {
      final cart = await _student.removeFromCart(item.copyId);
      if (!mounted) return;
      _setCart(cart);
      showInfo(context, '“${item.book.title}” removed');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _scan() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const StudentScanScreen(fromCart: true)));
    if (mounted) load();
  }

  Future<void> _generate() async {
    if (_busy) return;
    setState(() => _busy = true);
    final bus = context.read<RefreshBus>();
    try {
      final request = await _student.checkout();
      bus.bump();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => CheckoutQrScreen(request: request)));
    } catch (e) {
      if (!mounted) return;
      showError(context, e);
      setState(() => _busy = false);
      load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    final cart = d?.cart;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Borrow cart'),
            if (cart != null)
              Text(
                '${Fmt.plural(cart.items.length, 'book')} · ${cart.eligibility.remaining} more allowed',
                style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400),
              ),
          ],
        ),
      ),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d))),
      bottomNavigationBar: cart == null || cart.isEmpty
          ? null
          : BottomActions(
              top: cart.eligibility.ok || cart.eligibility.errors.isEmpty
                  ? null
                  : Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.red, size: 18),
                        const SizedBox(width: 6),
                        Expanded(child: Text(cart.eligibility.errors.first, style: const TextStyle(color: AppColors.red, fontSize: 13))),
                      ],
                    ),
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: cart.canCheckout && !_busy ? _generate : null,
                    icon: _busy
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.qr_code_2),
                    label: const Text('Generate Checkout QR'),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildBody(_CartData d) {
    final cart = d.cart;
    final pending = d.pending;
    final e = cart.eligibility;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (pending != null) ...[
          ToneBanner(
            tone: Tone.green,
            icon: Icons.qr_code_2,
            title: 'You have a pending checkout',
            subtitle: 'Generating a new QR replaces ${pending.code}',
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CheckoutQrScreen(request: pending))),
          ),
          const SizedBox(height: 12),
        ],
        if (cart.isEmpty)
          EmptyState(
            icon: Icons.shopping_bag_outlined,
            title: 'Your borrow cart is empty',
            message: 'Scan the QR label inside a book, or add one from its details page.',
            action: Wrap(
              spacing: 8,
              children: [
                FilledButton.icon(onPressed: _scan, icon: const Icon(Icons.qr_code_scanner), label: const Text('Scan a book')),
                OutlinedButton(
                  onPressed: () {
                    context.read<ShellController>().openExplore();
                    Navigator.of(context).popUntil((r) => r.isFirst);
                  },
                  child: const Text('Explore'),
                ),
              ],
            ),
          )
        else ...[
          StatGrid(columns: 3, children: [
            StatTile(label: 'In cart', value: '${cart.items.length}'),
            StatTile(label: 'Borrowed', value: '${e.activeCount}'),
            StatTile(label: 'Remaining', value: '${e.remaining}', warn: e.remaining < 0),
          ]),
          const SizedBox(height: 8),
          for (final item in cart.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  BookCover(title: item.book.title, width: 44, height: 62),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(item.copyId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                        Text('Shelf ${item.book.shelf}', style: const TextStyle(fontSize: 12, color: AppColors.primaryText)),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove ${item.book.title}',
                    onPressed: () => _remove(item),
                    icon: const Icon(Icons.delete_outline, color: AppColors.red),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 4),
          OutlinedButton.icon(onPressed: _scan, icon: const Icon(Icons.qr_code_scanner), label: const Text('Scan another book')),
          const SectionHeader('Borrowing checks'),
          CheckList(checks: e.checks),
          const SizedBox(height: 12),
          const ToneBanner(
            tone: Tone.gray,
            icon: Icons.event_outlined,
            title: 'Due date is set at approval',
            subtitle: 'Show the checkout QR at the counter. The librarian scans your books and approves the loan.',
          ),
        ],
      ],
    );
  }
}
