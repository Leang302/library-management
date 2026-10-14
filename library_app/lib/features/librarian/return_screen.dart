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
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import '../common/receipt_view.dart';
import 'member_detail_screen.dart';
import 'universal_scan_screen.dart';

/// Result of a completed return, handed back to the scanner.
class ReturnOutcome {
  const ReturnOutcome({required this.receiptId, required this.receiptNumber, required this.scanNext});

  final int? receiptId;
  final String? receiptNumber;

  /// True when the librarian tapped "Scan next book".
  final bool scanNext;
}

/// Opens the return flow from anywhere other than the scanner. If the librarian
/// taps "Scan next book", the scanner opens in Return mode on the same receipt.
Future<void> openReturnFlow(BuildContext context, String code, {int? receiptId}) async {
  final navigator = Navigator.of(context);
  final outcome = await navigator.push<ReturnOutcome>(
    MaterialPageRoute(builder: (_) => ReturnScreen(code: code, receiptId: receiptId)),
  );
  if (outcome != null && outcome.scanNext) {
    navigator.push(MaterialPageRoute<void>(
      builder: (_) => UniversalScanScreen(initialMode: ScanMode.returnBook, receiptId: outcome.receiptId),
    ));
  }
}

/// Return flow: preview -> condition + note -> confirm -> result.
class ReturnScreen extends StatefulWidget {
  const ReturnScreen({super.key, required this.code, this.receiptId});

  /// Scanned copy code (`BOOKCOPY-000001`).
  final String code;

  /// Receipt to add this return to (same visit), or null for a new receipt.
  final int? receiptId;

  @override
  State<ReturnScreen> createState() => _ReturnScreenState();
}

class _ReturnScreenState extends State<ReturnScreen> with Loader<ReturnScreen, ReturnPreview> {
  late final DeskService _desk = context.deskApi;
  final _note = TextEditingController();
  String _condition = 'GOOD';
  bool _submitting = false;
  ReturnResult? _result;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Future<ReturnPreview> fetch() => _desk.returnPreview(widget.code);

  Future<void> _confirm() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    final bus = context.read<RefreshBus>();
    try {
      final r = await _desk.processReturn(
        code: data?.copy.id ?? widget.code,
        condition: _condition,
        note: _note.text.trim(),
        receiptId: widget.receiptId,
      );
      bus.bump();
      if (!mounted) return;
      setState(() {
        _result = r;
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showError(context, e);
    }
  }

  void _scanNext() {
    final receipt = _result?.receipt;
    Navigator.of(context).pop(ReturnOutcome(
      receiptId: receipt?.id ?? widget.receiptId,
      receiptNumber: receipt?.number,
      scanNext: true,
    ));
  }

  void _done() => Navigator.of(context).popUntil((route) => route.isFirst);

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(result == null ? 'Process return' : 'Return complete'),
            Text(data?.copy.id ?? widget.code,
                style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
      ),
      body: result != null ? _buildResult(result) : _buildPreviewArea(),
      bottomNavigationBar: _buildFooter(),
    );
  }

  Widget _buildPreviewArea() {
    if (data == null && !loading && error != null) {
      return ListView(
        children: [
          EmptyState(
            icon: Icons.block,
            title: 'Cannot process this return',
            message: errorMessage(error!),
            action: Wrap(
              spacing: 8,
              children: [
                OutlinedButton(onPressed: load, child: const Text('Try again')),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Scan another book'),
                ),
              ],
            ),
          ),
        ],
      );
    }
    return buildLoaded(_buildPreview);
  }

  Widget? _buildFooter() {
    if (_result != null) {
      return BottomActions(children: [
        Expanded(child: OutlinedButton(onPressed: _done, child: const Text('Done'))),
        Expanded(
          child: FilledButton.icon(
            onPressed: _scanNext,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan next book'),
          ),
        ),
      ]);
    }
    if (data == null) return null;
    return BottomActions(children: [
      Expanded(
        child: FilledButton.icon(
          onPressed: _submitting || data!.loan == null ? null : _confirm,
          icon: _submitting
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.check),
          label: const Text('Confirm return'),
        ),
      ),
    ]);
  }

  Widget _buildPreview(ReturnPreview p) {
    final loan = p.loan;
    final member = p.member;
    final title = p.book?.title ?? p.copy.bookTitle;
    final author = p.book?.author ?? loan?.bookAuthor ?? '';
    final daysLeft = loan?.dueAt == null ? 0 : Fmt.daysUntil(loan!.dueAt!);
    final isLate = daysLeft < 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              BookCover(title: title, width: 56, height: 80),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    if (author.isNotEmpty) Text(author, style: const TextStyle(color: AppColors.muted)),
                    Text(p.copy.id, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                    const SizedBox(height: 6),
                    StatusChip(loan?.status ?? p.copy.status),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (loan == null) ...[
          const SizedBox(height: 12),
          const ToneBanner(
            tone: Tone.amber,
            icon: Icons.info_outline,
            title: 'This copy is not on loan',
            subtitle: 'There is nothing to return. Scan another book.',
          ),
        ],
        if (member != null || loan != null) ...[
          const SectionHeader('Borrower'),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: InitialsAvatar(name: member?.name ?? loan?.memberName ?? ''),
            title: Text(member?.name ?? loan?.memberName ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(member?.studentId ?? loan?.studentId ?? ''),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              final id = member?.id ?? loan?.memberId;
              if (id == null) return;
              Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MemberDetailScreen(memberId: id)));
            },
          ),
        ],
        if (loan != null) ...[
          const SectionHeader('Loan'),
          InfoCard(children: [
            InfoRow(label: 'Borrowed', value: Fmt.date(loan.borrowedAt), icon: Icons.event_outlined),
            InfoRow(label: 'Due', value: Fmt.date(loan.dueAt), icon: Icons.event_available_outlined),
            const InfoRow(label: 'Returned', value: 'Today', icon: Icons.undo),
            InfoRow(
              label: 'Status',
              value: '',
              icon: Icons.schedule,
              valueWidget: Text(
                isLate ? '${Fmt.plural(-daysLeft, 'day')} overdue' : 'On time',
                style: TextStyle(fontWeight: FontWeight.w600, color: isLate ? AppColors.red : AppColors.primaryText),
              ),
            ),
          ]),
          const SectionHeader('Condition'),
          Row(
            children: [
              Expanded(
                child: _ConditionCard(
                  selected: _condition == 'GOOD',
                  icon: Icons.verified_outlined,
                  title: 'Good',
                  subtitle: 'Back on the shelf',
                  tone: Tone.green,
                  onTap: () => setState(() => _condition = 'GOOD'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ConditionCard(
                  selected: _condition == 'DAMAGED',
                  icon: Icons.broken_image_outlined,
                  title: 'Damaged',
                  subtitle: 'To maintenance',
                  tone: Tone.red,
                  onTap: () => setState(() => _condition = 'DAMAGED'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: const InputDecoration(labelText: 'Condition note (optional)', hintText: 'e.g. torn page 45'),
          ),
          if (widget.receiptId != null) ...[
            const SizedBox(height: 12),
            const ToneBanner(
              tone: Tone.blue,
              icon: Icons.receipt_long_outlined,
              title: 'Same visit',
              subtitle: 'This book is added to the receipt started for this visit.',
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildResult(ReturnResult r) {
    final loan = r.loan;
    final receipt = r.receipt;
    final isLate = loan.daysLate > 0;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const Center(child: ResultMark(ok: true)),
        const SizedBox(height: 12),
        const Text('Book returned', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        Text('“${loan.bookTitle}” from ${loan.memberName}', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 16),
        InfoCard(children: [
          InfoRow(
            label: 'Timeliness',
            value: '',
            valueWidget: isLate
                ? StatusChip('OVERDUE', label: '${Fmt.plural(loan.daysLate, 'day')} late')
                : const StatusChip('RETURNED', label: 'On time', tone: Tone.green),
          ),
          InfoRow(label: 'Condition', value: '', valueWidget: StatusChip(loan.condition ?? _condition)),
          InfoRow(label: 'Copy is now', value: '', valueWidget: StatusChip(r.copyStatus)),
        ]),
        if (r.heldForName != null) ...[
          const SizedBox(height: 12),
          ToneBanner(
            tone: Tone.amber,
            icon: Icons.bookmark_outline,
            title: 'Reserved — put on the hold shelf',
            subtitle: 'This copy is now held for ${r.heldForName}.',
          ),
        ],
        if (receipt != null) ...[
          const SizedBox(height: 12),
          ToneBanner(
            tone: Tone.green,
            icon: Icons.receipt_long_outlined,
            title: 'Receipt ${receipt.number}',
            subtitle: '${Fmt.plural(receipt.lines.length, 'book')} on this receipt · sent to the student',
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ReceiptDetailScreen(receipt: receipt))),
          ),
        ],
      ],
    );
  }
}

class _ConditionCard extends StatelessWidget {
  const _ConditionCard({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.tone,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final Tone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? tone.bg : AppColors.bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: selected ? tone.fg : AppColors.border, width: selected ? 1.5 : 1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: selected ? tone.fg : AppColors.muted),
              const SizedBox(height: 6),
              Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? tone.fg : AppColors.text)),
              Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ],
          ),
        ),
      ),
    );
  }
}
