import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/book.dart';
import '../../core/state/cart_provider.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import 'book_detail_screen.dart';
import 'book_widgets.dart';
import 'cart_screen.dart';

/// Catalogue search for students: search box, category chips, grid of books.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  late final BooksService _books = context.booksApi;
  late final ShellController _shell = context.read<ShellController>();
  final _search = TextEditingController();
  Timer? _debounce;

  List<String> _categories = const [];
  String? _category;
  bool _availableOnly = false;

  static const _pageSize = 20;

  List<Book>? _results;
  Object? _error;
  bool _loading = true;
  int _seq = 0;

  // Paging ("load more" on scroll).
  int _page = 1;
  int _total = 0;
  bool _hasMore = false;
  bool _loadingMore = false;
  bool _moreFailed = false;

  @override
  void initState() {
    super.initState();
    _shell.addListener(_onShell);
    _applyShellRequest();
    _loadCategories();
    _load();
  }

  @override
  void dispose() {
    _shell.removeListener(_onShell);
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onShell() {
    if (_applyShellRequest()) {
      setState(() {});
      _load();
    }
  }

  /// Picks up "open Explore with this category / query" from Home.
  bool _applyShellRequest() {
    final req = _shell.takeExploreRequest();
    if (req == null) return false;
    _category = req.category;
    _search.text = req.query ?? '';
    return true;
  }

  Future<void> _loadCategories() async {
    try {
      final c = await _books.categories();
      if (mounted) setState(() => _categories = c);
    } catch (_) {
      // Chips are optional.
    }
  }

  Future<void> _load() async {
    final seq = ++_seq;
    if (!_loading) setState(() => _loading = true);
    try {
      final result = await _fetch(1);
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = List<Book>.of(result.items);
        _page = 1;
        _total = result.totalElements;
        _hasMore = result.hasNext;
        _moreFailed = false;
        _loadingMore = false;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = e;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<PageResult<Book>> _fetch(int page) => _books.list(
        q: _search.text.trim(),
        category: _category,
        availableOnly: _availableOnly,
        page: page,
        size: _pageSize,
      );

  Future<void> _loadMore() async {
    if (_loading || _loadingMore || !_hasMore || _results == null) return;
    final seq = _seq;
    setState(() {
      _loadingMore = true;
      _moreFailed = false;
    });
    try {
      final result = await _fetch(_page + 1);
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = [...?_results, ...result.items];
        _page += 1;
        _total = result.totalElements;
        _hasMore = result.hasNext && result.items.isNotEmpty;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _loadingMore = false;
        _moreFailed = true;
      });
    }
  }

  bool _onScroll(ScrollNotification n) {
    if (n.metrics.axis == Axis.vertical && n.metrics.extentAfter < 600 && _hasMore && !_loadingMore && !_moreFailed) {
      _loadMore();
    }
    return false;
  }

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
    setState(() {}); // shows/hides the clear button
  }

  void _clearFilters() {
    _search.clear();
    setState(() {
      _category = null;
      _availableOnly = false;
    });
    _load();
  }

  Future<void> _open(Book b) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BookDetailScreen(bookId: b.id)));
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartProvider>().count;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        actions: [
          BadgeIconButton(
            icon: Icons.shopping_bag_outlined,
            count: cartCount,
            tooltip: 'Borrow cart',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onChanged: _onQueryChanged,
              onSubmitted: (_) {
                _debounce?.cancel();
                _load();
              },
              decoration: InputDecoration(
                hintText: 'Title, author, category or ISBN',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _search.clear();
                          _load();
                          setState(() {});
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                FilterChip(
                  label: const Text('Available now'),
                  selected: _availableOnly,
                  onSelected: (v) {
                    setState(() => _availableOnly = v);
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('All'),
                  selected: _category == null,
                  showCheckmark: false,
                  onSelected: (_) {
                    setState(() => _category = null);
                    _load();
                  },
                ),
                for (final c in _categories) ...[
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: Text(c),
                    selected: _category == c,
                    showCheckmark: false,
                    onSelected: (_) {
                      setState(() => _category = c);
                      _load();
                    },
                  ),
                ],
              ],
            ),
          ),
          if (_loading && _results != null) const LinearProgressIndicator(minHeight: 2),
          Expanded(child: _buildResults()),
        ],
      ),
    );
  }

  Widget _buildResults() {
    final results = _results;
    if (results == null) {
      if (_loading) return const Center(child: CircularProgressIndicator());
      return ListView(children: [ErrorState(error: _error ?? 'Unknown error', onRetry: _load)]);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: results.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                EmptyState(
                  icon: Icons.search_off,
                  title: 'No books found',
                  message: 'Try a different keyword, category or availability filter.',
                  action: OutlinedButton(onPressed: _clearFilters, child: const Text('Clear filters')),
                ),
              ],
            )
          : NotificationListener<ScrollNotification>(
              onNotification: _onScroll,
              child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  sliver: SliverToBoxAdapter(
                    child: Text(
                      Fmt.plural(_total > results.length ? _total : results.length, 'book') + (_search.text.trim().isEmpty ? '' : ' for “${_search.text.trim()}”'),
                      style: const TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, _hasMore ? 8 : 100),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.56,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 18,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => BookGridCard(book: results[i], onTap: () => _open(results[i])),
                      childCount: results.length,
                    ),
                  ),
                ),
                if (_hasMore)
                  SliverPadding(
                    padding: const EdgeInsets.only(bottom: 100),
                    sliver: SliverToBoxAdapter(
                      child: Center(
                        child: _loadingMore
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
                              )
                            : OutlinedButton.icon(
                                onPressed: _loadMore,
                                icon: Icon(_moreFailed ? Icons.refresh : Icons.expand_more),
                                label: Text(_moreFailed ? 'Retry loading more' : 'Load more'),
                              ),
                      ),
                    ),
                  ),
              ],
            ),
            ),
    );
  }
}
