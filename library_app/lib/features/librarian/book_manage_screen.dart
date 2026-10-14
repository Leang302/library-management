import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/book.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import 'book_form_screen.dart';
import 'copy_info_screen.dart';

/// Staff view of a title: details, all copies, edit / add copies / archive / delete.
class BookManageScreen extends StatefulWidget {
  const BookManageScreen({super.key, required this.bookId});

  final int bookId;

  @override
  State<BookManageScreen> createState() => _BookManageScreenState();
}

class _BookManageScreenState extends State<BookManageScreen> with Loader<BookManageScreen, BookDetail> {
  late final BooksService _books = context.booksApi;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<BookDetail> fetch() => _books.detail(widget.bookId);

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    final bus = context.read<RefreshBus>();
    try {
      await action();
      bus.bump();
      await load();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(Book b) async {
    final updated = await Navigator.of(context).push<Book>(MaterialPageRoute(builder: (_) => BookFormScreen(book: b)));
    if (!mounted || updated == null) return;
    context.read<RefreshBus>().bump();
    load();
  }

  Future<void> _addCopies(Book b) async {
    final count = await showDialog<int>(context: context, builder: (_) => const _AddCopiesDialog());
    if (count == null || count <= 0 || !mounted) return;
    await _run(() async {
      final copies = await _books.addCopies(b.id, count);
      if (mounted) showSuccess(context, '${Fmt.plural(copies.isEmpty ? count : copies.length, 'copy', 'copies')} added');
    });
  }

  Future<void> _toggleArchive(Book b) async {
    final archive = !b.archived;
    final ok = await confirmDialog(
      context,
      title: archive ? 'Archive “${b.title}”?' : 'Restore “${b.title}”?',
      message: archive
          ? 'The title is hidden from students and can’t be borrowed. Loan history is kept.'
          : 'The title becomes visible and borrowable again.',
      confirmText: archive ? 'Archive' : 'Restore',
      danger: archive,
    );
    if (!ok || !mounted) return;
    await _run(() async {
      await _books.setArchived(b.id, archive);
      if (mounted) showSuccess(context, archive ? 'Title archived' : 'Title restored');
    });
  }

  Future<void> _delete(Book b) async {
    final ok = await confirmDialog(
      context,
      title: 'Delete “${b.title}”?',
      message: 'This cannot be undone. Titles that were ever borrowed can only be archived.',
      confirmText: 'Delete',
      danger: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    final bus = context.read<RefreshBus>();
    try {
      await _books.delete(b.id);
      bus.bump();
      if (!mounted) return;
      showSuccess(context, 'Title deleted');
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showError(context, e);
    }
  }

  Future<void> _openCopy(BookCopy c) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CopyInfoScreen(copyId: c.id)));
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    return Scaffold(
      appBar: AppBar(
        title: Text(d?.book.title ?? 'Book'),
        actions: [
          if (d != null)
            PopupMenuButton<String>(
              enabled: !_busy,
              onSelected: (v) {
                switch (v) {
                  case 'edit':
                    _edit(d.book);
                  case 'copies':
                    _addCopies(d.book);
                  case 'archive':
                    _toggleArchive(d.book);
                  case 'delete':
                    _delete(d.book);
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit details')),
                const PopupMenuItem(value: 'copies', child: Text('Add copies')),
                PopupMenuItem(value: 'archive', child: Text(d.book.archived ? 'Restore title' : 'Archive title')),
                const PopupMenuItem(value: 'delete', child: Text('Delete title', style: TextStyle(color: AppColors.red))),
              ],
            ),
        ],
      ),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d))),
      bottomNavigationBar: d == null
          ? null
          : BottomActions(children: [
              Expanded(
                child: OutlinedButton.icon(onPressed: _busy ? null : () => _edit(d.book), icon: const Icon(Icons.edit_outlined), label: const Text('Edit')),
              ),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy || d.book.archived ? null : () => _addCopies(d.book),
                  icon: const Icon(Icons.add),
                  label: const Text('Add copies'),
                ),
              ),
            ]),
    );
  }

  Widget _buildBody(BookDetail d) {
    final b = d.book;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BookCover(title: b.title, author: b.author, width: 84, height: 120),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(b.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  Text(b.author, style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    if (b.category.isNotEmpty) StatusChip(null, label: b.category, tone: Tone.gray, dense: true),
                    if (b.archived) const StatusChip('EXPIRED', label: 'Archived', dense: true),
                  ]),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        StatGrid(columns: 4, children: [
          StatTile(label: 'Total', value: '${b.totalCopies}'),
          StatTile(label: 'Available', value: '${b.availableCopies}'),
          StatTile(label: 'Borrowed', value: '${b.borrowedCopies}'),
          StatTile(label: 'Queue', value: '${d.queueLength}'),
        ]),
        const SizedBox(height: 16),
        InfoCard(children: [
          InfoRow(label: 'ISBN', value: b.isbn.isEmpty ? '—' : b.isbn),
          InfoRow(label: 'Publisher', value: b.publisher.isEmpty ? '—' : b.publisher),
          InfoRow(label: 'Year', value: b.year?.toString() ?? '—'),
          InfoRow(label: 'Language', value: b.language.isEmpty ? '—' : b.language),
          InfoRow(label: 'Pages', value: b.pages?.toString() ?? '—'),
          InfoRow(label: 'Shelf', value: b.shelf.isEmpty ? '—' : b.shelf),
        ]),
        SectionHeader('Copies (${d.copies.length})'),
        if (d.copies.isEmpty)
          const Text('No physical copies yet. Use “Add copies”.', style: TextStyle(color: AppColors.muted))
        else
          for (final c in d.copies)
            ListTile(
              contentPadding: EdgeInsets.zero,
              onTap: () => _openCopy(c),
              leading: const Icon(Icons.qr_code_2, color: AppColors.muted),
              title: Text(c.id, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)),
              subtitle: Text(c.currentLoan != null
                  ? '${c.currentLoan!.memberName} · ${Fmt.dueLabel(c.currentLoan!.dueAt)}'
                  : (c.note.isNotEmpty ? c.note : Fmt.enumLabel(c.condition))),
              trailing: StatusChip(c.status, dense: true),
            ),
        if (b.description.isNotEmpty) ...[
          const SectionHeader('Description'),
          Text(b.description, style: const TextStyle(color: AppColors.text2, height: 1.5)),
        ],
      ],
    );
  }
}

class _AddCopiesDialog extends StatefulWidget {
  const _AddCopiesDialog();

  @override
  State<_AddCopiesDialog> createState() => _AddCopiesDialogState();
}

class _AddCopiesDialogState extends State<_AddCopiesDialog> {
  final _count = TextEditingController(text: '1');
  String? _error;

  @override
  void dispose() {
    _count.dispose();
    super.dispose();
  }

  void _submit() {
    final n = int.tryParse(_count.text.trim());
    if (n == null || n < 1 || n > 50) {
      setState(() => _error = 'Enter a number from 1 to 50');
      return;
    }
    Navigator.pop(context, n);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add copies'),
      content: TextField(
        controller: _count,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: 'Number of new copies', errorText: _error),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(0, 40)), onPressed: _submit, child: const Text('Add')),
      ],
    );
  }
}
