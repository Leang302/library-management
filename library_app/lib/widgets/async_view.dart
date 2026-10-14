import 'package:flutter/material.dart';

import '../core/models/page.dart';
import 'empty_state.dart';
import 'feedback.dart';

/// Loading / error / data state for a screen that fetches one value.
///
/// Usage: `class _S extends State<X> with Loader<X, MyData>` + implement [fetch],
/// call [load] from `initState`, and render with [buildLoaded].
mixin Loader<W extends StatefulWidget, T> on State<W> {
  T? data;
  Object? error;

  /// True until the first fetch finishes (and during every reload).
  bool loading = true;

  /// Only the most recent load may update the state (filters can change mid-flight).
  int _loadSeq = 0;

  Future<T> fetch();

  Future<void> load() async {
    final seq = ++_loadSeq;
    if (!loading) setState(() => loading = true);
    try {
      final result = await fetch();
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        data = result;
        error = null;
        loading = false;
      });
    } catch (e) {
      if (!mounted || seq != _loadSeq) return;
      final hadData = data != null;
      setState(() {
        error = e;
        loading = false;
      });
      if (hadData) showError(context, e);
    }
  }

  /// Spinner on first load, error state when nothing loaded yet, otherwise [builder].
  /// The error state is scrollable so a surrounding RefreshIndicator still works.
  Widget buildLoaded(Widget Function(T data) builder) {
    final d = data;
    if (d != null) return builder(d);
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [ErrorState(error: error ?? 'Unknown error', onRetry: load)],
      ),
    );
  }
}

/// Like [Loader], for paged list endpoints: [load] fetches page 1, [loadMore]
/// appends the next page. Implement [fetchPage]; render with [buildLoaded],
/// wrap the scrollable in [infiniteScroll] and append [loadMoreFooter] as the
/// last list item while [hasMore] (or always - it collapses when done).
mixin PagedLoader<W extends StatefulWidget, T> on State<W> {
  List<T>? data;
  Object? error;

  /// True until the first page arrives (and during every reload).
  bool loading = true;

  /// True while the next page is being fetched.
  bool loadingMore = false;

  /// Server says there are more pages after the last loaded one.
  bool hasMore = false;

  /// Total matching rows reported by the server.
  int totalElements = 0;

  int _page = 1;
  int _loadSeq = 0;
  Object? _moreError;

  Future<PageResult<T>> fetchPage(int page);

  Future<void> load() async {
    final seq = ++_loadSeq;
    if (!loading) setState(() => loading = true);
    try {
      final result = await fetchPage(1);
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        data = List<T>.of(result.items);
        _page = result.page < 1 ? 1 : result.page;
        hasMore = result.hasNext;
        totalElements = result.totalElements;
        error = null;
        _moreError = null;
        loading = false;
        loadingMore = false;
      });
    } catch (e) {
      if (!mounted || seq != _loadSeq) return;
      final hadData = data != null;
      setState(() {
        error = e;
        loading = false;
        loadingMore = false;
      });
      if (hadData) showError(context, e);
    }
  }

  Future<void> loadMore() async {
    if (loading || loadingMore || !hasMore || data == null) return;
    final seq = _loadSeq;
    setState(() {
      loadingMore = true;
      _moreError = null;
    });
    try {
      final result = await fetchPage(_page + 1);
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        data = [...?data, ...result.items];
        _page = _page + 1;
        hasMore = result.hasNext && result.items.isNotEmpty;
        totalElements = result.totalElements;
        loadingMore = false;
      });
    } catch (e) {
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        loadingMore = false;
        _moreError = e;
      });
    }
  }

  /// Loads the next page when the user scrolls near the end.
  Widget infiniteScroll(Widget scrollable) {
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.axis == Axis.vertical && n.metrics.extentAfter < 400 && hasMore && !loadingMore && _moreError == null) {
          loadMore();
        }
        return false;
      },
      child: scrollable,
    );
  }

  /// Spinner while loading the next page, a "Load more" button otherwise
  /// (also the retry after a failed page), nothing when all rows are loaded.
  Widget loadMoreFooter() {
    if (!hasMore) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: loadingMore
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
            : OutlinedButton.icon(
                onPressed: loadMore,
                icon: Icon(_moreError == null ? Icons.expand_more : Icons.refresh),
                label: Text(_moreError == null ? 'Load more' : 'Retry loading more'),
              ),
      ),
    );
  }

  /// Spinner on first load, error state when nothing loaded yet, otherwise [builder].
  Widget buildLoaded(Widget Function(List<T> data) builder) {
    final d = data;
    if (d != null) return builder(d);
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [ErrorState(error: error ?? 'Unknown error', onRetry: load)],
      ),
    );
  }
}
