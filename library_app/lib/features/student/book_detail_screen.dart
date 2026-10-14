import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import 'cart_screen.dart';
import 'student_scan_screen.dart';

/// Student view of a title: availability, Add to cart, Reserve / leave queue.
class BookDetailScreen extends StatefulWidget {
  const BookDetailScreen({super.key, required this.bookId});

  final int bookId;

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> with Loader<BookDetailScreen, BookDetail> {
  late final BooksService _books = context.booksApi;
  late final StudentService _student = context.studentApi;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    load();
    final cart = context.read<CartProvider>();
    if (cart.cart == null) cart.refresh(_student);
  }

  @override
  Future<BookDetail> fetch() => _books.detail(widget.bookId);

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addToCart(Book b) => _run(() async {
        final cartProvider = context.read<CartProvider>();
        final bus = context.read<RefreshBus>();
        final cart = await _student.addBookToCart(b.id);
        cartProvider.set(cart);
        bus.bump();
        if (!mounted) return;
        showSuccess(context, 'Added to borrow cart — take any copy from shelf ${b.shelf}');
        await load();
      });

  Future<void> _reserve(BookDetail d) async {
    final ok = await confirmDialog(
      context,
      title: 'Reserve “${d.book.title}”?',
      message: 'You’ll join a queue of ${d.queueLength}. We’ll notify you when a copy is held for you.',
      confirmText: 'Reserve',
    );
    if (!ok || !mounted) return;
    await _run(() async {
      final bus = context.read<RefreshBus>();
      final r = await _student.reserve(d.book.id);
      bus.bump();
      if (!mounted) return;
      showSuccess(context, r.position > 0 ? 'Reserved — you’re #${r.position} in the queue' : 'Reserved');
      await load();
    });
  }

  Future<void> _cancelReservation(Reservation r) async {
    final ok = await confirmDialog(
      context,
      title: 'Cancel this reservation?',
      message: 'You will lose your place in the queue.',
      confirmText: 'Cancel reservation',
      cancelText: 'Keep',
      danger: true,
    );
    if (!ok || !mounted) return;
    await _run(() async {
      final bus = context.read<RefreshBus>();
      await _student.cancelReservation(r.id);
      bus.bump();
      if (!mounted) return;
      showInfo(context, 'Reservation cancelled');
      await load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final inCart = context.watch<CartProvider>().containsBook(widget.bookId);
    return Scaffold(
      appBar: AppBar(title: Text(data?.book.title ?? 'Book')),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d))),
      bottomNavigationBar: data == null ? null : _buildFooter(data!, inCart),
    );
  }

  Widget _buildBody(BookDetail d) {
    final b = d.book;
    final r = d.myReservation;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(vertical: 24),
          decoration: BoxDecoration(
            color: BookCover.colorFor(b.title).withAlpha(28),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Center(child: BookCover.large(title: b.title, author: b.author)),
        ),
        const SizedBox(height: 16),
        if (b.category.isNotEmpty) Center(child: StatusChip(null, label: b.category, tone: Tone.gray)),
        const SizedBox(height: 8),
        Text(b.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        Text('by ${b.author}', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          children: [
            if (!b.isAvailable && !b.archived) const StatusChip('UNAVAILABLE', label: 'All copies out', tone: Tone.red),
            if (b.archived) const StatusChip('EXPIRED', label: 'Archived'),
            if (r != null) StatusChip(r.status, label: r.isReady ? 'Reserved for you' : '#${r.position} in queue'),
          ],
        ),
        const SizedBox(height: 16),
        StatGrid(columns: 4, children: [
          StatTile(label: 'Total', value: '${b.totalCopies}'),
          StatTile(label: 'Available', value: '${b.availableCopies}'),
          StatTile(label: 'Waiting', value: '${d.queueLength}'),
          StatTile(label: 'Shelf', value: b.shelf.isEmpty ? '—' : b.shelf),
        ]),
        if (b.description.isNotEmpty) ...[
          const SectionHeader('About this book'),
          Text(b.description, style: const TextStyle(color: AppColors.text2, height: 1.5)),
        ],
        const SizedBox(height: 16),
        InfoCard(children: [
          InfoRow(label: 'ISBN', value: b.isbn.isEmpty ? '—' : b.isbn, icon: Icons.qr_code),
          InfoRow(label: 'Publisher', value: b.publisher.isEmpty ? '—' : b.publisher, icon: Icons.business_outlined),
          InfoRow(label: 'Published', value: b.year?.toString() ?? '—', icon: Icons.calendar_today_outlined),
          InfoRow(label: 'Language', value: b.language.isEmpty ? '—' : b.language, icon: Icons.language),
          if (b.pages != null) InfoRow(label: 'Pages', value: '${b.pages}', icon: Icons.description_outlined),
          InfoRow(label: 'Location', value: 'Shelf ${b.shelf}', icon: Icons.place_outlined),
        ]),
        const SizedBox(height: 12),
        if (!b.isAvailable && !b.archived && r == null)
          const ToneBanner(
            tone: Tone.amber,
            icon: Icons.info_outline,
            title: 'All copies are out',
            subtitle: 'Reserve to join the queue — we’ll hold the next returned copy for you.',
          ),
        if (b.isAvailable)
          ToneBanner(
            tone: Tone.green,
            icon: Icons.qr_code_scanner,
            title: 'Borrowing tip',
            subtitle: 'Take a copy from shelf ${b.shelf} and scan the QR label inside the cover — or tap “Add to Borrow Cart”.',
          ),
      ],
    );
  }

  Widget _buildFooter(BookDetail d, bool inCart) {
    final b = d.book;
    final r = d.myReservation;
    Widget primary(String label, IconData icon, VoidCallback? onPressed, {Color? color}) => Expanded(
          child: FilledButton.icon(
            style: color == null ? null : FilledButton.styleFrom(backgroundColor: color),
            onPressed: _busy ? null : onPressed,
            icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Icon(icon),
            label: Text(label),
          ),
        );

    final List<Widget> children;
    if (b.archived) {
      children = [const Expanded(child: FilledButton(onPressed: null, child: Text('Not in circulation')))];
    } else if (inCart) {
      children = [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
            icon: const Icon(Icons.shopping_bag_outlined),
            label: const Text('In your cart — view'),
          ),
        ),
      ];
    } else if (r != null && r.isReady) {
      children = [primary('Reserved for you — add to cart', Icons.bookmark_added_outlined, () => _addToCart(b))];
    } else if (r != null && r.isWaiting) {
      children = [
        Expanded(
          child: OutlinedButton(
            onPressed: _busy ? null : () => _cancelReservation(r),
            child: Text('Leave queue (#${r.position})'),
          ),
        ),
      ];
    } else if (b.isAvailable) {
      children = [
        OutlinedButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const StudentScanScreen())),
          style: OutlinedButton.styleFrom(minimumSize: const Size(52, 48), padding: EdgeInsets.zero),
          child: const Icon(Icons.qr_code_scanner),
        ),
        primary('Add to Borrow Cart', Icons.add, () => _addToCart(b)),
      ];
    } else {
      children = [
        primary('Reserve — ${d.queueLength} waiting', Icons.bookmark_add_outlined, () => _reserve(d), color: AppColors.amber),
      ];
    }
    return BottomActions(children: children);
  }
}
