import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/scanner_view.dart';
import 'cart_screen.dart';

/// Student scanner: each scanned book copy goes straight into the borrow cart.
/// Continuous mode - the camera keeps scanning so several books can be added.
class StudentScanScreen extends StatefulWidget {
  const StudentScanScreen({super.key, this.fromCart = false});

  /// Opened from the cart: "View cart" just goes back.
  final bool fromCart;

  @override
  State<StudentScanScreen> createState() => _StudentScanScreenState();
}

class _StudentScanScreenState extends State<StudentScanScreen> {
  static const _samples = [
    ScanSample('BOOKCOPY-000001'),
    ScanSample('BOOKCOPY-000002'),
    ScanSample('BOOKCOPY-000003'),
    ScanSample('BOOKCOPY-000004'),
    ScanSample('BOOKCOPY-000005'),
    ScanSample('BOOKCOPY-000006'),
  ];

  late final StudentService _student = context.studentApi;

  Future<ScanFeedback?> _onCode(String code) async {
    final cartProvider = context.read<CartProvider>();
    final bus = context.read<RefreshBus>();
    final before = cartProvider.copyIds;
    try {
      final cart = await _student.addToCart(code);
      cartProvider.set(cart);
      bus.bump();
      final added = cart.items.where((i) => !before.contains(i.copyId)).toList();
      final title = added.isNotEmpty ? added.first.book.title : 'Book';
      if (mounted) showSuccess(context, '“$title” added to your cart');
    } catch (e) {
      if (mounted) showError(context, e);
    }
    return null;
  }

  void _openCart() {
    if (widget.fromCart) {
      Navigator.of(context).pop();
      return;
    }
    Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const CartScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final count = context.watch<CartProvider>().count;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan book QR'),
        actions: [
          BadgeIconButton(icon: Icons.shopping_bag_outlined, count: count, tooltip: 'Borrow cart', onPressed: _openCart),
          const SizedBox(width: 4),
        ],
      ),
      body: ScannerView(
        onCode: _onCode,
        hint: 'Find the QR label inside the front cover',
        placeholder: 'Copy ID, e.g. BOOKCOPY-000004',
        samples: _samples,
        footer: FilledButton.icon(
          onPressed: count > 0 ? _openCart : null,
          icon: const Icon(Icons.shopping_bag_outlined),
          label: Text(count > 0 ? 'View cart ($count)' : 'View cart'),
        ),
      ),
    );
  }
}
