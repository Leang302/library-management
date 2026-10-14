import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/book.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
import 'book_form_screen.dart';
import 'book_manage_screen.dart';

/// Staff inventory: every title with copy counts; add / open titles.
class BooksInventoryScreen extends StatefulWidget {
  const BooksInventoryScreen({super.key});

  @override
  State<BooksInventoryScreen> createState() => _BooksInventoryScreenState();
}

class _BooksInventoryScreenState extends State<BooksInventoryScreen> with PagedLoader<BooksInventoryScreen, Book> {
  late final BooksService _books = context.booksApi;
  late final RefreshBus _bus = context.read<RefreshBus>();
  final _search = TextEditingController();
  bool _showArchived = false;

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
  Future<PageResult<Book>> fetchPage(int page) =>
      _books.list(q: _search.text.trim(), includeArchived: _showArchived, sort: 'title', page: page, size: 30);

  Future<void> _open(Book b) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BookManageScreen(bookId: b.id)));
    if (mounted) load();
  }

  Future<void> _add() async {
    final created = await Navigator.of(context).push<Book>(MaterialPageRoute(builder: (_) => const BookFormScreen()));
    if (!mounted) return;
    load();
    if (created != null) {
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BookManageScreen(bookId: created.id)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = data;
    final totalCopies = list?.fold<int>(0, (s, b) => s + b.totalCopies) ?? 0;
    final available = list?.fold<int>(0, (s, b) => s + b.availableCopies) ?? 0;
    // Copy totals are only exact once every page is loaded.
    final subtitle = list == null
        ? null
        : (hasMore
            ? Fmt.plural(totalElements, 'title')
            : '${Fmt.plural(list.length, 'title')} · $available of $totalCopies copies available');
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Books', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            if (subtitle != null)
              Text(subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
        toolbarHeight: 64,
        actions: [
          IconButton(tooltip: 'Add book', icon: const Icon(Icons.add), onPressed: _add),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => load(),
              decoration: InputDecoration(
                hintText: 'Title, author, ISBN',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: 'Clear',
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    _search.clear();
                    load();
                  },
                ),
              ),
            ),
          ),
          SwitchListTile(
            dense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
            title: const Text('Show archived titles'),
            value: _showArchived,
            onChanged: (v) {
              setState(() => _showArchived = v);
              load();
            },
          ),
          Expanded(
            child: buildLoaded((list) => RefreshIndicator(
                  onRefresh: load,
                  child: list.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            EmptyState(
                              icon: Icons.library_books_outlined,
                              title: 'No books found',
                              message: 'Try another search, or add a new title.',
                              action: FilledButton.icon(onPressed: _add, icon: const Icon(Icons.add), label: const Text('Add book')),
                            ),
                          ],
                        )
                      : infiniteScroll(ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: list.length + 1,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            if (i == list.length) return loadMoreFooter();
                            final b = list[i];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              onTap: () => _open(b),
                              leading: BookCover(title: b.title, width: 36, height: 50),
                              title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                '${b.author} · Shelf ${b.shelf}\n${b.availableCopies}/${b.totalCopies} available · ${b.borrowedCopies} borrowed',
                              ),
                              isThreeLine: true,
                              trailing: b.archived
                                  ? const StatusChip('EXPIRED', label: 'Archived', dense: true)
                                  : (b.availableCopies == 0
                                      ? const StatusChip('LOST', label: 'All out', dense: true)
                                      : const Icon(Icons.chevron_right, color: AppColors.faint)),
                            );
                          },
                        )),
                )),
          ),
        ],
      ),
    );
  }
}
