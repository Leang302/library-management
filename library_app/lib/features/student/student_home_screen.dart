import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/auth_provider.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../common/loan_sheet.dart';
import '../common/notifications_screen.dart';
import 'book_detail_screen.dart';
import 'book_widgets.dart';
import 'cart_screen.dart';
import 'checkout_qr_screen.dart';
import 'member_card_screen.dart';

class _HomeData {
  const _HomeData({
    required this.loans,
    required this.pending,
    required this.reservations,
    required this.newArrivals,
    required this.categories,
    required this.unread,
  });

  final List<Loan> loans;
  final BorrowRequest? pending;
  final List<Reservation> reservations;
  final List<Book> newArrivals;
  final List<String> categories;
  final int unread;
}

class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> with Loader<StudentHomeScreen, _HomeData> {
  late final RefreshBus _bus = context.read<RefreshBus>();
  late final StudentService _student = context.studentApi;
  late final BooksService _books = context.booksApi;
  late final NotificationService _notifications = context.notificationsApi;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _bus.addListener(load);
    load();
  }

  @override
  void dispose() {
    _bus.removeListener(load);
    _search.dispose();
    super.dispose();
  }

  @override
  Future<_HomeData> fetch() async {
    final r = await Future.wait<dynamic>([
      _student.loans(scope: 'current'),
      _student.currentCheckout(),
      _student.reservations(),
      _books.list(sort: 'createdAt', direction: 'DESC', size: 10),
      _books.categories().catchError((Object _) => <String>[]),
      _notifications.unreadCount().catchError((Object _) => 0),
    ]);
    final books = List<Book>.from((r[3] as PageResult<Book>).items)..sort((a, b) => b.id.compareTo(a.id));
    final loans = List<Loan>.from(r[0] as List<Loan>)
      ..sort((a, b) => (a.dueAt ?? DateTime(9999)).compareTo(b.dueAt ?? DateTime(9999)));
    return _HomeData(
      loans: loans,
      pending: r[1] as BorrowRequest?,
      reservations: r[2] as List<Reservation>,
      newArrivals: books.take(10).toList(),
      categories: r[4] as List<String>,
      unread: r[5] as int,
    );
  }

  Future<void> _refresh() async {
    final cart = context.read<CartProvider>();
    await Future.wait([load(), cart.refresh(_student)]);
  }

  Future<void> _push(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final cartCount = context.watch<CartProvider>().count;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${Fmt.greeting()},', style: const TextStyle(fontSize: 13, color: AppColors.muted, fontWeight: FontWeight.w400)),
            Text(user?.firstName ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          ],
        ),
        actions: [
          BadgeIconButton(icon: Icons.shopping_bag_outlined, count: cartCount, tooltip: 'Borrow cart', onPressed: () => _push(const CartScreen())),
          BadgeIconButton(
            icon: Icons.notifications_none,
            count: data?.unread ?? 0,
            tooltip: 'Notifications',
            onPressed: () => _push(const NotificationsScreen()),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: _refresh, child: _buildBody(d, user))),
    );
  }

  Widget _buildBody(_HomeData d, User? user) {
    final shell = context.read<ShellController>();
    final member = user?.member;
    final dueSoon = d.loans.where((l) => l.dueAt != null && Fmt.daysUntil(l.dueAt!) <= 3).length;
    final holds = d.reservations.where((r) => r.isLive).length;
    final ready = d.reservations.where((r) => r.isReady).toList();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
      children: [
        TextField(
          controller: _search,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'Search title, author or ISBN', prefixIcon: Icon(Icons.search)),
          onSubmitted: (q) {
            _search.clear();
            shell.openExplore(query: q.trim());
          },
        ),
        const SizedBox(height: 14),
        if (member != null)
          Material(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => _push(const MemberCardScreen()),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.qr_code_2, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Library card', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                          Text('${member.studentId} · valid until ${Fmt.monthYear(member.expiresAt)}',
                              style: TextStyle(color: Colors.white.withAlpha(220), fontSize: 13)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.white.withAlpha(40), borderRadius: BorderRadius.circular(20)),
                      child: Text(member.canBorrow ? 'Active' : 'Inactive',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        StatGrid(columns: 3, children: [
          StatTile(label: 'Borrowed', value: '${d.loans.length}', onTap: () => shell.openMyBooks()),
          StatTile(label: 'Due soon', value: '$dueSoon', warn: dueSoon > 0, onTap: () => shell.openMyBooks()),
          StatTile(label: 'Holds', value: '$holds', onTap: () => shell.openMyBooks(tabIndex: 1)),
        ]),
        if (d.pending != null) ...[
          const SizedBox(height: 12),
          ToneBanner(
            tone: Tone.green,
            icon: Icons.qr_code_2,
            title: 'Checkout QR ready',
            subtitle: '${Fmt.plural(d.pending!.items.length, 'book')} · show it at the counter',
            onTap: () => _push(CheckoutQrScreen(request: d.pending!)),
          ),
        ],
        for (final r in ready) ...[
          const SizedBox(height: 12),
          ToneBanner(
            tone: Tone.amber,
            icon: Icons.bookmark_added_outlined,
            title: 'Reservation ready!',
            subtitle: '“${r.bookTitle}” held until ${Fmt.short(r.holdUntil)}',
            onTap: () => _push(BookDetailScreen(bookId: r.bookId)),
          ),
        ],
        if (d.loans.isNotEmpty) ...[
          SectionHeader('Currently borrowed', actionLabel: 'My books', onAction: () => shell.openMyBooks()),
          for (final l in d.loans) LoanCard(loan: l, onTap: () => showLoanSheet(context, l)),
        ],
        if (d.categories.isNotEmpty) ...[
          const SectionHeader('Browse by category'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in d.categories)
                ActionChip(label: Text(c), onPressed: () => shell.openExplore(category: c)),
            ],
          ),
        ],
        if (d.newArrivals.isNotEmpty) ...[
          SectionHeader('New arrivals', onAction: () => shell.openExplore()),
          SizedBox(
            height: 210,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: d.newArrivals.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, i) {
                final b = d.newArrivals[i];
                return ShelfItem(book: b, onTap: () => _push(BookDetailScreen(bookId: b.id)));
              },
            ),
          ),
        ],
      ],
    );
  }
}
