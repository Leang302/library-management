import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/check_list.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import 'handover_scan_screen.dart';
import 'member_detail_screen.dart';

/// Librarian review of a checkout request: student, books (with handover ticks),
/// policy checks, then Approve / Reject.
class RequestReviewScreen extends StatefulWidget {
  const RequestReviewScreen({super.key, required this.requestId, this.fromScanner = false});

  final int requestId;

  /// Opened from the scanner: the result screen offers "Scan next".
  final bool fromScanner;

  @override
  State<RequestReviewScreen> createState() => _RequestReviewScreenState();
}

class _RequestReviewScreenState extends State<RequestReviewScreen> with Loader<RequestReviewScreen, Review> {
  late final DeskService _desk = context.deskApi;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<Review> fetch() => _desk.review(widget.requestId);

  Future<void> _scanHandover(Review rv) async {
    final updated = await Navigator.of(context).push<Review>(
      MaterialPageRoute(builder: (_) => HandoverScanScreen(review: rv)),
    );
    if (!mounted) return;
    if (updated != null) setState(() => data = updated);
    load();
  }

  Future<void> _approve() async {
    if (_busy) return;
    setState(() => _busy = true);
    final bus = context.read<RefreshBus>();
    try {
      final result = await _desk.approve(widget.requestId);
      bus.bump();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
        builder: (_) => CheckoutApprovedScreen(result: result, fromScanner: widget.fromScanner),
      ));
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showError(context, e);
      load();
    }
  }

  Future<void> _reject() async {
    final reason = await showDialog<String>(context: context, builder: (_) => const RejectReasonDialog());
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    final bus = context.read<RefreshBus>();
    try {
      await _desk.reject(widget.requestId, reason);
      bus.bump();
      if (!mounted) return;
      showInfo(context, 'Checkout rejected — the student has been notified');
      setState(() => _busy = false);
      load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rv = data;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Review checkout'),
            if (rv != null)
              Text(rv.request.code, style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
      ),
      body: buildLoaded((rv) => RefreshIndicator(onRefresh: load, child: _buildBody(rv))),
      bottomNavigationBar: rv == null ? null : _buildFooter(rv),
    );
  }

  Widget _buildBody(Review rv) {
    final r = rv.request;
    final m = rv.member;
    final pending = r.isPending;
    final failed = rv.checks.where((c) => !c.ok && c.key != 'handover').length;
    final scanLeft = rv.needScan && pending ? rv.scanLeft : 0;

    final Tone tone;
    final IconData icon;
    final String headline;
    if (!pending) {
      tone = toneForStatus(r.status);
      icon = Icons.info_outline;
      headline = 'Request ${Fmt.enumLabel(r.status).toLowerCase()}';
    } else if (failed > 0) {
      tone = Tone.red;
      icon = Icons.gpp_bad_outlined;
      headline = '${Fmt.plural(failed, 'check')} failed';
    } else if (scanLeft > 0) {
      tone = Tone.gray;
      icon = Icons.qr_code_scanner;
      headline = 'Checks passed · scan ${Fmt.plural(scanLeft, 'book')} to finish';
    } else {
      tone = Tone.green;
      icon = Icons.verified_user_outlined;
      headline = rv.ok ? 'Ready to approve' : 'Not ready';
    }
    final sub = pending
        ? 'Requested ${Fmt.relative(r.requestedAt)} · expires ${Fmt.time(r.expiresAt)}'
        : 'Processed ${Fmt.dateTime(r.processedAt)}${r.processedByName == null ? '' : ' by ${r.processedByName}'}';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        ToneBanner(tone: tone, icon: icon, title: headline, subtitle: sub),
        if (r.isRejected && r.rejectReason != null) ...[
          const SizedBox(height: 8),
          ToneBanner(tone: Tone.red, icon: Icons.cancel_outlined, title: 'Reason', subtitle: r.rejectReason),
        ],
        const SectionHeader('Student'),
        Material(
          color: AppColors.bgSubtle,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: m == null
                ? null
                : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MemberDetailScreen(memberId: m.id))),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  InitialsAvatar(name: r.memberName, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.memberName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                        Text(m == null ? r.studentId : '${m.studentId} · ${m.program}', style: const TextStyle(color: AppColors.muted)),
                        if (m != null) ...[
                          const SizedBox(height: 6),
                          Wrap(spacing: 6, runSpacing: 4, children: [
                            StatusChip(m.status, tone: m.canBorrow ? Tone.green : Tone.red, label: m.canBorrow ? 'Active member' : (m.isExpired ? 'Expired' : 'Suspended'), dense: true),
                            StatusChip(null, label: '${m.activeLoans} on loan', tone: Tone.gray, dense: true),
                            if (m.overdueLoans > 0) StatusChip('OVERDUE', label: '${m.overdueLoans} overdue', dense: true),
                          ]),
                        ],
                      ],
                    ),
                  ),
                  if (m != null) const Icon(Icons.chevron_right, color: AppColors.faint),
                ],
              ),
            ),
          ),
        ),
        SectionHeader('Books to hand over (${rv.items.length})'),
        if (pending && rv.needScan)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text(
              'Scan the label on each book as you hand it over. Any copy of the requested title works — the loan is recorded against the copy you scan.',
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
        for (final it in rv.items) _ReviewItemRow(item: it, pending: pending, needScan: rv.needScan),
        const SectionHeader('Policy validation'),
        CheckList(checks: rv.checks),
        if (pending && rv.needScan) ...[
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _busy ? null : () => _scanHandover(rv),
            icon: const Icon(Icons.qr_code_scanner),
            label: Text('Scan books being handed over (${rv.scanned}/${rv.items.length})'),
          ),
        ],
      ],
    );
  }

  Widget? _buildFooter(Review rv) {
    final r = rv.request;
    if (!r.isPending) {
      return BottomActions(children: [
        Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Back'))),
      ]);
    }
    final failed = rv.checks.where((c) => !c.ok && c.key != 'handover').isNotEmpty;
    final scanLeft = rv.needScan ? rv.scanLeft : 0;
    final Widget main;
    if (scanLeft > 0 && !failed) {
      main = FilledButton.icon(
        onPressed: _busy ? null : () => _scanHandover(rv),
        icon: const Icon(Icons.qr_code_scanner),
        label: Text('Scan books (${rv.scanned}/${rv.items.length})'),
      );
    } else {
      main = FilledButton.icon(
        onPressed: rv.ok && !_busy ? _approve : null,
        icon: _busy
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.check),
        label: const Text('Approve checkout'),
      );
    }
    return BottomActions(children: [
      OutlinedButton.icon(
        style: OutlinedButton.styleFrom(foregroundColor: AppColors.red, side: const BorderSide(color: AppColors.red)),
        onPressed: _busy ? null : _reject,
        icon: const Icon(Icons.close),
        label: const Text('Reject'),
      ),
      Expanded(child: main),
    ]);
  }
}

class _ReviewItemRow extends StatelessWidget {
  const _ReviewItemRow({required this.item, required this.pending, required this.needScan});

  final ReviewItem item;
  final bool pending;
  final bool needScan;

  @override
  Widget build(BuildContext context) {
    final i = item.item;
    final verified = i.verified;
    Widget status;
    if (pending && !item.ok) {
      status = Text(item.issue ?? 'Not available', style: const TextStyle(color: AppColors.red, fontSize: 12));
    } else if (pending && needScan) {
      status = verified
          ? Text('Scanned${i.swappedFrom == null ? '' : ' · switched from ${i.swappedFrom}'}',
              style: const TextStyle(color: AppColors.primaryText, fontSize: 12, fontWeight: FontWeight.w600))
          : const Text('Not scanned yet', style: TextStyle(color: AppColors.muted, fontSize: 12));
    } else {
      status = const SizedBox.shrink();
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: pending && !item.ok ? AppColors.red50 : (verified ? AppColors.primary50 : AppColors.bg),
        border: Border.all(color: pending && !item.ok ? AppColors.red : AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          BookCover(title: i.bookTitle, width: 40, height: 56),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(i.bookTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(i.copyId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                status,
              ],
            ),
          ),
          if (pending && needScan)
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: verified ? AppColors.primary : AppColors.bgMuted,
                shape: BoxShape.circle,
              ),
              child: Icon(verified ? Icons.check : Icons.qr_code_scanner, size: 18, color: verified ? Colors.white : AppColors.muted),
            ),
        ],
      ),
    );
  }
}

/// Asks for a rejection reason. Returns the reason text, or null if cancelled.
class RejectReasonDialog extends StatefulWidget {
  const RejectReasonDialog({super.key});

  @override
  State<RejectReasonDialog> createState() => _RejectReasonDialogState();
}

class _RejectReasonDialogState extends State<RejectReasonDialog> {
  static const _reasons = [
    'Student did not present a valid ID',
    'Book copy damaged at counter',
    'Wrong copy brought to counter',
  ];
  static const _other = 'Other';

  String _choice = _reasons.first;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final note = _note.text.trim();
    final reason = _choice == _other ? (note.isEmpty ? 'Rejected at counter' : note) : (note.isEmpty ? _choice : '$_choice — $note');
    Navigator.pop(context, reason);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Reject checkout'),
      contentPadding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text('Choose a reason. The student will be notified.', style: TextStyle(color: AppColors.muted)),
            ),
            const SizedBox(height: 8),
            for (final r in [..._reasons, _other])
              ListTile(
                dense: true,
                leading: Icon(_choice == r ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                    color: _choice == r ? AppColors.primary : AppColors.faint),
                title: Text(r),
                onTap: () => setState(() => _choice = r),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: TextField(
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Note (optional)', hintText: 'Add details for the student'),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppColors.red, minimumSize: const Size(0, 40)),
          onPressed: _submit,
          child: const Text('Reject request'),
        ),
      ],
    );
  }
}

/// Shown after a successful approval: the loan receipt.
class CheckoutApprovedScreen extends StatelessWidget {
  const CheckoutApprovedScreen({super.key, required this.result, this.fromScanner = false});

  final ApproveResult result;
  final bool fromScanner;

  @override
  Widget build(BuildContext context) {
    final r = result.request;
    final loans = result.loans;
    final due = result.dueAt ?? (loans.isNotEmpty ? loans.first.dueAt : null);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout receipt')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 8),
          const Center(child: ResultMark(ok: true)),
          const SizedBox(height: 12),
          const Text('Checkout complete', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          Text('${Fmt.plural(loans.length, 'book')} lent to ${r.memberName}',
              textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            decoration: BoxDecoration(
              color: AppColors.bgSubtle,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Greenleaf Library', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700)),
                Text('Loan receipt · ${r.code}', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                const Divider(height: 20),
                InfoRow(label: 'Member', value: '${r.memberName} · ${r.studentId}'),
                InfoRow(label: 'Approved', value: Fmt.dateTime(r.processedAt ?? DateTime.now())),
                InfoRow(label: 'Librarian', value: r.processedByName ?? '—'),
                const Divider(height: 20),
                for (final l in loans)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.bookTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(l.copyId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                            ],
                          ),
                        ),
                        Text('Due ${Fmt.short(l.dueAt)}'),
                      ],
                    ),
                  ),
                const Divider(height: 20),
                InfoRow(label: 'Total books', value: '${loans.length}'),
                InfoRow(label: 'Due date', value: Fmt.date(due)),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActions(children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
            child: const Text('Done'),
          ),
        ),
        if (fromScanner)
          Expanded(
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan next'),
            ),
          ),
      ]),
    );
  }
}
