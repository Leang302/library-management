import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import 'cart_screen.dart';

/// The student's checkout pass. Shows the QR, counts down to expiry, renews the
/// token shortly before it lapses, and polls every 3 s for the librarian's decision.
class CheckoutQrScreen extends StatefulWidget {
  const CheckoutQrScreen({super.key, required this.request});

  final BorrowRequest request;

  @override
  State<CheckoutQrScreen> createState() => _CheckoutQrScreenState();
}

class _CheckoutQrScreenState extends State<CheckoutQrScreen> {
  static const _refreshBefore = Duration(seconds: 30);
  static const _pollEvery = Duration(seconds: 3);

  late final StudentService _student = context.studentApi;
  late BorrowRequest _req = widget.request;
  Timer? _ticker;
  Timer? _poller;
  bool _refreshing = false;
  bool _polling = false;
  bool _cancelling = false;
  DateTime? _dueAt;

  @override
  void initState() {
    super.initState();
    if (_req.isPending) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      _poller = Timer.periodic(_pollEvery, (_) => _poll());
      // Make sure we have the owner's QR payload and the latest state.
      _poll();
    } else if (_req.isApproved) {
      _loadDueDate();
    }
  }

  @override
  void dispose() {
    _stopTimers();
    super.dispose();
  }

  void _stopTimers() {
    _ticker?.cancel();
    _poller?.cancel();
    _ticker = null;
    _poller = null;
  }

  Duration get _remaining {
    final exp = _req.expiresAt;
    if (exp == null) return Duration.zero;
    return exp.difference(DateTime.now());
  }

  void _tick() {
    if (!mounted || !_req.isPending) return;
    if (_remaining < _refreshBefore) _renew();
    setState(() {}); // countdown
  }

  Future<void> _renew() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      final r = await _student.refreshCheckout(_req.id);
      if (mounted) _apply(r);
    } catch (_) {
      // The poll will surface EXPIRED / APPROVED etc.
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _poll() async {
    if (_polling) return;
    _polling = true;
    try {
      final r = await _student.checkoutById(_req.id);
      if (mounted) _apply(r);
    } catch (_) {
      // Transient network errors: keep polling.
    } finally {
      _polling = false;
    }
  }

  void _apply(BorrowRequest r) {
    final wasPending = _req.isPending;
    // Keep the payload we already have if this response omitted it.
    final merged = (r.qrPayload == null && _req.qrPayload != null && r.isPending)
        ? BorrowRequest(
            id: r.id,
            code: r.code,
            qrPayload: _req.qrPayload,
            memberId: r.memberId,
            memberName: r.memberName,
            studentId: r.studentId,
            status: r.status,
            requestedAt: r.requestedAt,
            expiresAt: r.expiresAt,
            processedAt: r.processedAt,
            processedByName: r.processedByName,
            rejectReason: r.rejectReason,
            items: r.items,
          )
        : r;
    setState(() => _req = merged);
    if (wasPending && !merged.isPending) {
      _stopTimers();
      context.read<RefreshBus>().bump();
      context.read<CartProvider>().refresh(_student);
      if (merged.isApproved) {
        showSuccess(context, 'Your books are checked out!');
        _loadDueDate();
      }
    }
  }

  Future<void> _loadDueDate() async {
    try {
      final loans = await _student.loans(scope: 'current');
      final mine = loans.where((l) => l.requestId == _req.id).toList();
      if (!mounted || mine.isEmpty) return;
      setState(() => _dueAt = mine.first.dueAt);
    } catch (_) {
      // Due date is a nice-to-have on this screen.
    }
  }

  Future<void> _cancel() async {
    final ok = await confirmDialog(
      context,
      title: 'Cancel this checkout?',
      message: 'The QR code will stop working. Your cart is kept.',
      confirmText: 'Cancel checkout',
      cancelText: 'Keep',
      danger: true,
    );
    if (!ok || !mounted) return;
    setState(() => _cancelling = true);
    final bus = context.read<RefreshBus>();
    try {
      await _student.cancelCheckout(_req.id);
      _stopTimers();
      bus.bump();
      if (!mounted) return;
      showInfo(context, 'Checkout cancelled');
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const CartScreen()));
    } catch (e) {
      if (!mounted) return;
      setState(() => _cancelling = false);
      showError(context, e);
    }
  }

  void _goToMyBooks() {
    context.read<ShellController>().openMyBooks();
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final r = _req;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Checkout pass'),
            Text('${Fmt.plural(r.items.length, 'book')} · ${r.code}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (r.isPending) _buildPending(r) else _buildResult(r),
          const SizedBox(height: 20),
          InfoCard(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
            children: [
              const Text('Books in this checkout', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted, fontSize: 13)),
              for (final i in r.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      BookCover(title: i.bookTitle, width: 32, height: 46),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(i.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(i.copyId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: BottomActions(children: _footer(r)),
    );
  }

  List<Widget> _footer(BorrowRequest r) {
    if (r.isPending) {
      return [
        OutlinedButton(onPressed: _cancelling ? null : _cancel, child: const Text('Cancel')),
        Expanded(child: FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done'))),
      ];
    }
    if (r.isApproved) {
      return [
        Expanded(
          child: FilledButton.icon(onPressed: _goToMyBooks, icon: const Icon(Icons.menu_book), label: const Text('View my books')),
        ),
      ];
    }
    return [
      Expanded(
        child: FilledButton.icon(
          onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
          icon: const Icon(Icons.refresh),
          label: const Text('Back to cart'),
        ),
      ),
    ];
  }

  Widget _buildPending(BorrowRequest r) {
    final payload = r.qrPayload;
    final remaining = _remaining;
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
          decoration: BoxDecoration(
            color: AppColors.primary50,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _PulseDot(),
                  SizedBox(width: 8),
                  Text('Waiting for approval', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.primaryText)),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                child: payload == null
                    ? const SizedBox(width: 232, height: 232, child: Center(child: CircularProgressIndicator()))
                    : QrImageView(data: payload, size: 232, backgroundColor: Colors.white),
              ),
              const SizedBox(height: 12),
              Text(r.code, style: const TextStyle(fontFamily: 'monospace', fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: 2)),
              const SizedBox(height: 4),
              Text(
                remaining.inSeconds > 0
                    ? 'Expires in ${Fmt.countdown(remaining)} · renews automatically'
                    : 'Renewing…',
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const Text('Show this QR code to the librarian at the checkout counter.',
            textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        const Text(
          'Turn your screen brightness up if the scanner can’t read it. The code holds no personal data and refreshes itself, so screenshots won’t work.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildResult(BorrowRequest r) {
    final String title;
    final String message;
    switch (r.status) {
      case RequestStatus.approved:
        title = 'Checkout approved';
        message = 'Approved ${Fmt.dateTime(r.processedAt)}${r.processedByName == null ? '' : ' by ${r.processedByName}'}';
      case RequestStatus.rejected:
        title = 'Checkout rejected';
        message = r.rejectReason ?? 'Please speak to the librarian.';
      case RequestStatus.expired:
        title = 'QR code expired';
        message = 'Generate a new checkout QR from your cart when you’re at the counter.';
      default:
        title = 'Request cancelled';
        message = 'This checkout request is no longer valid.';
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          ResultMark(ok: r.isApproved),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
          if (r.isApproved && _dueAt != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(12)),
              child: Text('Due ${Fmt.date(_dueAt)}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primaryText)),
            ),
          ],
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot();

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 1).animate(_c),
      child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle)),
    );
  }
}
