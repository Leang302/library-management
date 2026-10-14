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
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import '../common/loan_sheet.dart';
import '../common/notifications_screen.dart';
import '../common/receipt_view.dart';
import 'book_detail_screen.dart';
import 'book_widgets.dart';
import 'cart_screen.dart';
import 'checkout_qr_screen.dart';

/// Borrowed / Reservations / History / Receipts.
class MyBooksScreen extends StatefulWidget {
  const MyBooksScreen({super.key});

  @override
  State<MyBooksScreen> createState() => _MyBooksScreenState();
}

class _MyBooksScreenState extends State<MyBooksScreen> with SingleTickerProviderStateMixin {
  late final ShellController _shell = context.read<ShellController>();
  late final TabController _tabs = TabController(length: 4, vsync: this, initialIndex: _shell.takeMyBooksTab() ?? 0);

  @override
  void initState() {
    super.initState();
    _shell.addListener(_onShell);
  }

  @override
  void dispose() {
    _shell.removeListener(_onShell);
    _tabs.dispose();
    super.dispose();
  }

  void _onShell() {
    if (_shell.tab != AppTab.myBooks) return;
    final t = _shell.takeMyBooksTab();
    if (t != null && t != _tabs.index) _tabs.animateTo(t);
  }

  void _push(Widget screen) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartProvider>().count;
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Books', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        actions: [
          BadgeIconButton(icon: Icons.shopping_bag_outlined, count: cartCount, tooltip: 'Borrow cart', onPressed: () => _push(const CartScreen())),
          IconButton(tooltip: 'Notifications', icon: const Icon(Icons.notifications_none), onPressed: () => _push(const NotificationsScreen())),
          const SizedBox(width: 4),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Borrowed'),
            Tab(text: 'Reservations'),
            Tab(text: 'History'),
            Tab(text: 'Receipts'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _LoansTab(scope: 'current'),
          _ReservationsTab(),
          _LoansTab(scope: 'history'),
          _ReceiptsTab(),
        ],
      ),
    );
  }
}

/// Mixin: reload when the app-wide RefreshBus fires.
mixin _BusReload<W extends StatefulWidget, T> on Loader<W, T> {
  RefreshBus? _bus;

  void listenBus() {
    _bus = context.read<RefreshBus>()..addListener(load);
  }

  @override
  void dispose() {
    _bus?.removeListener(load);
    super.dispose();
  }
}

class _LoansData {
  const _LoansData(this.loans, this.pending);
  final List<Loan> loans;
  final BorrowRequest? pending;
}

class _LoansTab extends StatefulWidget {
  const _LoansTab({required this.scope});

  final String scope;

  @override
  State<_LoansTab> createState() => _LoansTabState();
}

class _LoansTabState extends State<_LoansTab> with Loader<_LoansTab, _LoansData>, _BusReload<_LoansTab, _LoansData> {
  late final StudentService _student = context.studentApi;

  bool get _current => widget.scope == 'current';

  @override
  void initState() {
    super.initState();
    listenBus();
    load();
  }

  @override
  Future<_LoansData> fetch() async {
    if (!_current) {
      final loans = await _student.loans(scope: 'history');
      loans.sort((a, b) => (b.returnedAt ?? DateTime(0)).compareTo(a.returnedAt ?? DateTime(0)));
      return _LoansData(loans, null);
    }
    final r = await Future.wait<dynamic>([_student.loans(scope: 'current'), _student.currentCheckout()]);
    final loans = List<Loan>.from(r[0] as List<Loan>)
      ..sort((a, b) => (a.dueAt ?? DateTime(9999)).compareTo(b.dueAt ?? DateTime(9999)));
    return _LoansData(loans, r[1] as BorrowRequest?);
  }

  @override
  Widget build(BuildContext context) {
    return buildLoaded((d) {
      final children = <Widget>[];
      if (d.pending != null) {
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ToneBanner(
            tone: Tone.green,
            icon: Icons.qr_code_2,
            title: 'Checkout QR ready',
            subtitle: '${d.pending!.code} · ${Fmt.plural(d.pending!.items.length, 'book')} · show it at the counter',
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute<void>(builder: (_) => CheckoutQrScreen(request: d.pending!)))
                .then((_) => load()),
          ),
        ));
      }
      if (d.loans.isEmpty) {
        children.add(_current
            ? EmptyState(
                icon: Icons.menu_book_outlined,
                title: 'No borrowed books',
                message: 'Books you check out at the counter show up here.',
                action: FilledButton(
                  onPressed: () => context.read<ShellController>().openExplore(),
                  child: const Text('Find a book'),
                ),
              )
            : const EmptyState(icon: Icons.history, title: 'No history yet', message: 'Returned books will be listed here.'));
      } else if (_current) {
        for (final l in d.loans) {
          children.add(LoanCard(loan: l, onTap: () => showLoanSheet(context, l)));
          children.add(const Divider(height: 1));
        }
        children.add(const SizedBox(height: 12));
        children.add(const ToneBanner(
          tone: Tone.gray,
          icon: Icons.undo,
          title: 'How to return',
          subtitle: 'Return each book any time before its own due date. At the counter the librarian scans the book’s label and a return receipt appears in your app.',
        ));
      } else {
        for (final l in d.loans) {
          children.add(ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: () => showLoanSheet(context, l),
            leading: BookCover(title: l.bookTitle, width: 36, height: 50),
            title: Text(l.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text('${Fmt.short(l.borrowedAt)} → ${Fmt.short(l.returnedAt)}'),
            trailing: l.returnedLate
                ? StatusChip('OVERDUE', label: 'Late · ${l.daysLate}d', dense: true)
                : const StatusChip('RETURNED', label: 'On time', tone: Tone.green, dense: true),
          ));
        }
      }
      return RefreshIndicator(
        onRefresh: load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          children: children,
        ),
      );
    });
  }
}

class _ReservationsTab extends StatefulWidget {
  const _ReservationsTab();

  @override
  State<_ReservationsTab> createState() => _ReservationsTabState();
}

class _ReservationsTabState extends State<_ReservationsTab>
    with Loader<_ReservationsTab, List<Reservation>>, _BusReload<_ReservationsTab, List<Reservation>> {
  late final StudentService _student = context.studentApi;

  @override
  void initState() {
    super.initState();
    listenBus();
    load();
  }

  @override
  Future<List<Reservation>> fetch() async {
    final list = await _student.reservations();
    list.sort((a, b) {
      if (a.isLive != b.isLive) return a.isLive ? -1 : 1;
      return (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0));
    });
    return list;
  }

  Future<void> _cancel(Reservation r) async {
    final ok = await confirmDialog(context,
        title: 'Cancel this reservation?', message: 'You will lose your place in the queue.', confirmText: 'Cancel reservation', cancelText: 'Keep', danger: true);
    if (!ok || !mounted) return;
    final bus = context.read<RefreshBus>();
    try {
      await _student.cancelReservation(r.id);
      if (!mounted) return;
      showInfo(context, 'Reservation cancelled');
      bus.bump();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _addToCart(Reservation r) async {
    final cart = context.read<CartProvider>();
    final bus = context.read<RefreshBus>();
    try {
      cart.set(await _student.addBookToCart(r.bookId));
      if (!mounted) return;
      showSuccess(context, '“${r.bookTitle}” added to your cart');
      bus.bump();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  String _subtitle(Reservation r) {
    switch (r.status) {
      case ReservationStatus.waiting:
        return '#${r.position} in queue · since ${Fmt.short(r.createdAt)}';
      case ReservationStatus.ready:
        return 'Pick up by ${Fmt.date(r.holdUntil)}${r.copyId == null ? '' : ' · ${r.copyId}'}';
      default:
        return 'Reserved ${Fmt.short(r.createdAt)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return buildLoaded((list) => RefreshIndicator(
          onRefresh: load,
          child: list.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    EmptyState(
                      icon: Icons.bookmark_border,
                      title: 'No reservations',
                      message: 'Reserve a book that’s out on loan and we’ll hold the next copy for you.',
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final r = list[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BookDetailScreen(bookId: r.bookId))),
                            child: BookCover(title: r.bookTitle, width: 40, height: 56),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                                Text(_subtitle(r), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                                const SizedBox(height: 4),
                                StatusChip(r.status, dense: true),
                              ],
                            ),
                          ),
                          if (r.isLive)
                            Column(
                              children: [
                                if (r.isReady)
                                  TextButton(onPressed: () => _addToCart(r), child: const Text('Add to cart')),
                                TextButton(
                                  style: TextButton.styleFrom(foregroundColor: AppColors.red),
                                  onPressed: () => _cancel(r),
                                  child: const Text('Cancel'),
                                ),
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                ),
        ));
  }
}

class _ReceiptsTab extends StatefulWidget {
  const _ReceiptsTab();

  @override
  State<_ReceiptsTab> createState() => _ReceiptsTabState();
}

class _ReceiptsTabState extends State<_ReceiptsTab> with Loader<_ReceiptsTab, List<Receipt>>, _BusReload<_ReceiptsTab, List<Receipt>> {
  late final StudentService _student = context.studentApi;

  @override
  void initState() {
    super.initState();
    listenBus();
    load();
  }

  @override
  Future<List<Receipt>> fetch() async {
    final list = await _student.receipts();
    list.sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return buildLoaded((list) => RefreshIndicator(
          onRefresh: load,
          child: list.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    EmptyState(icon: Icons.receipt_long_outlined, title: 'No receipts yet', message: 'Every return gives you a receipt here.'),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 100),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final r = list[i];
                    return ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.primary50,
                        foregroundColor: AppColors.primaryText,
                        child: Icon(Icons.receipt_long_outlined),
                      ),
                      title: Text('${r.typeLabel} · ${r.number}'),
                      subtitle: Text('${Fmt.plural(r.lines.length, 'book')} · ${Fmt.dateTime(r.createdAt)}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ReceiptDetailScreen(receipt: r))),
                    );
                  },
                ),
        ));
  }
}
