import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import 'book_manage_screen.dart';
import 'member_detail_screen.dart';
import 'return_screen.dart';

/// A physical copy: status, condition, current borrower; change status.
class CopyInfoScreen extends StatefulWidget {
  const CopyInfoScreen({super.key, required this.copyId});

  final String copyId;

  @override
  State<CopyInfoScreen> createState() => _CopyInfoScreenState();
}

class _CopyInfoScreenState extends State<CopyInfoScreen> with Loader<CopyInfoScreen, BookCopy> {
  late final DeskService _desk = context.deskApi;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<BookCopy> fetch() => _desk.copy(widget.copyId);

  Future<void> _changeStatus(BookCopy c) async {
    final choice = await showModalBottomSheet<_StatusChoice>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _StatusSheet(current: c.status, note: c.note),
    );
    if (choice == null || !mounted) return;
    final bus = context.read<RefreshBus>();
    try {
      final updated = await _desk.setCopyStatus(c.id, choice.status, note: choice.note);
      bus.bump();
      if (!mounted) return;
      setState(() => data = updated);
      showSuccess(context, '${c.id} marked ${Fmt.enumLabel(updated.status).toLowerCase()}');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _return(BookCopy c) async {
    await openReturnFlow(context, c.id);
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) {
    final c = data;
    return Scaffold(
      appBar: AppBar(title: Text(c?.id ?? widget.copyId)),
      body: buildLoaded((c) => RefreshIndicator(onRefresh: load, child: _buildBody(c))),
      bottomNavigationBar: c == null
          ? null
          : BottomActions(children: [
              if (c.status != CopyStatus.borrowed)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _changeStatus(c),
                    icon: const Icon(Icons.tune),
                    label: const Text('Change status'),
                  ),
                ),
              if (c.isOnLoan)
                Expanded(
                  child: FilledButton.icon(onPressed: () => _return(c), icon: const Icon(Icons.undo), label: const Text('Process return')),
                ),
            ]),
    );
  }

  Widget _buildBody(BookCopy c) {
    final loan = c.currentLoan;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Row(
          children: [
            BookCover(title: c.bookTitle, width: 64, height: 92),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.bookTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  Text(c.id, style: const TextStyle(fontFamily: 'monospace', color: AppColors.muted)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, children: [StatusChip(c.status), StatusChip(c.condition)]),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        InfoCard(children: [
          InfoRow(label: 'Status', value: Fmt.enumLabel(c.status), icon: Icons.info_outline),
          InfoRow(label: 'Condition', value: Fmt.enumLabel(c.condition), icon: Icons.fact_check_outlined),
          if (c.note.isNotEmpty) InfoRow(label: 'Note', value: c.note, icon: Icons.sticky_note_2_outlined),
        ]),
        if (loan != null) ...[
          const SectionHeader('Current loan'),
          InfoCard(children: [
            InfoRow(label: 'Borrower', value: '${loan.memberName} · ${loan.studentId}', icon: Icons.person_outline),
            InfoRow(label: 'Borrowed', value: Fmt.date(loan.borrowedAt), icon: Icons.event_outlined),
            InfoRow(
              label: 'Due',
              value: '',
              icon: Icons.event_available_outlined,
              valueWidget: Text('${Fmt.date(loan.dueAt)} · ${Fmt.dueLabel(loan.dueAt)}',
                  style: TextStyle(fontWeight: FontWeight.w600, color: Fmt.dueTone(loan.dueAt).fg)),
            ),
          ]),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MemberDetailScreen(memberId: loan.memberId))),
            icon: const Icon(Icons.person_outline),
            label: const Text('View borrower'),
          ),
        ],
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BookManageScreen(bookId: c.bookId))),
          icon: const Icon(Icons.library_books_outlined),
          label: const Text('View title & all copies'),
        ),
      ],
    );
  }
}

class _StatusChoice {
  const _StatusChoice(this.status, this.note);
  final String status;
  final String note;
}

class _StatusSheet extends StatefulWidget {
  const _StatusSheet({required this.current, required this.note});

  final String current;
  final String note;

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  static const _options = [CopyStatus.available, CopyStatus.maintenance, CopyStatus.lost];
  late String _status = _options.contains(widget.current) ? widget.current : CopyStatus.available;
  late final TextEditingController _note = TextEditingController(text: widget.note);

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Change copy status', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          for (final s in _options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(_status == s ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: _status == s ? AppColors.primary : AppColors.faint),
              title: Text(Fmt.enumLabel(s)),
              trailing: StatusChip(s, dense: true),
              onTap: () => setState(() => _status = s),
            ),
          const SizedBox(height: 8),
          TextField(controller: _note, decoration: const InputDecoration(labelText: 'Note (optional)')),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.pop(context, _StatusChoice(_status, _note.text.trim())),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}
