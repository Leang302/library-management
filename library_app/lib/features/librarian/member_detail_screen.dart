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
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import '../common/loan_sheet.dart';
import 'return_screen.dart';

/// Member record: card, eligibility, current loans, reservations,
/// suspend / activate and renew.
class MemberDetailScreen extends StatefulWidget {
  const MemberDetailScreen({super.key, required this.memberId});

  final int memberId;

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> with Loader<MemberDetailScreen, MemberDetail> {
  late final DeskService _desk = context.deskApi;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<MemberDetail> fetch() => _desk.member(widget.memberId);

  Future<void> _toggleStatus(Member m) async {
    final suspend = !m.isSuspended;
    final ok = await confirmDialog(
      context,
      title: suspend ? 'Suspend membership?' : 'Reactivate membership?',
      message: suspend ? 'The member will not be able to borrow until reactivated.' : 'The member will be able to borrow again.',
      confirmText: suspend ? 'Suspend' : 'Activate',
      danger: suspend,
    );
    if (!ok || !mounted) return;
    await _run(() async {
      await _desk.setMemberStatus(m.id, suspend ? 'SUSPENDED' : 'ACTIVE');
      if (mounted) showSuccess(context, suspend ? 'Membership suspended' : 'Membership activated');
    });
  }

  Future<void> _renew(Member m) async {
    final ok = await confirmDialog(context,
        title: 'Renew membership?', message: 'Extends ${m.name}’s membership expiry date.', confirmText: 'Renew');
    if (!ok || !mounted) return;
    await _run(() async {
      final updated = await _desk.renewMember(m.id);
      if (mounted) showSuccess(context, 'Membership renewed until ${Fmt.date(updated.expiresAt)}');
    });
  }

  Future<void> _run(Future<void> Function() action) async {
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

  @override
  Widget build(BuildContext context) {
    final m = data?.member;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Member'),
        actions: [
          if (m != null)
            PopupMenuButton<String>(
              enabled: !_busy,
              onSelected: (v) {
                if (v == 'status') _toggleStatus(m);
                if (v == 'renew') _renew(m);
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'status', child: Text(m.isSuspended ? 'Activate membership' : 'Suspend membership')),
                const PopupMenuItem(value: 'renew', child: Text('Renew membership')),
              ],
            ),
        ],
      ),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d))),
    );
  }

  Widget _buildBody(MemberDetail d) {
    final m = d.member;
    final current = d.loans.where((l) => !l.isReturned).toList();
    final past = d.loans.where((l) => l.isReturned).toList();
    final liveReservations = d.reservations.where((r) => r.isLive).toList();
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            InitialsAvatar(name: m.name, size: 60),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(m.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  Text(m.email, style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 6),
                  StatusChip(
                    m.status,
                    tone: m.canBorrow ? Tone.green : Tone.red,
                    label: m.isSuspended ? 'Suspended' : (m.isExpired ? 'Expired' : 'Active member'),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        InfoCard(children: [
          InfoRow(label: 'Student ID', value: m.studentId, icon: Icons.badge_outlined),
          InfoRow(label: 'Program', value: m.year == null ? m.program : '${m.program} · Year ${m.year}', icon: Icons.school_outlined),
          InfoRow(label: 'Member since', value: Fmt.date(m.joinedAt), icon: Icons.event_outlined),
          InfoRow(label: 'Expires', value: Fmt.date(m.expiresAt), icon: Icons.event_busy_outlined),
        ]),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : () => _toggleStatus(m),
                style: m.isSuspended ? null : OutlinedButton.styleFrom(foregroundColor: AppColors.red),
                child: Text(m.isSuspended ? 'Activate' : 'Suspend'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(onPressed: _busy ? null : () => _renew(m), child: const Text('Renew')),
            ),
          ],
        ),
        const SectionHeader('Borrowing eligibility'),
        StatGrid(columns: 3, children: [
          StatTile(label: 'On loan', value: '${d.eligibility.activeCount}'),
          StatTile(label: 'Overdue', value: '${d.eligibility.overdueCount}', warn: d.eligibility.overdueCount > 0),
          StatTile(label: 'Can borrow', value: '${d.eligibility.remaining}'),
        ]),
        const SizedBox(height: 10),
        CheckList(checks: d.eligibility.checks),
        SectionHeader('Current loans (${current.length})'),
        if (current.isEmpty)
          const InlineEmpty(icon: Icons.menu_book_outlined, text: 'No books on loan')
        else
          for (final l in current) _loanTile(l),
        if (liveReservations.isNotEmpty) ...[
          SectionHeader('Reservations (${liveReservations.length})'),
          for (final r in liveReservations)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: BookCover(title: r.bookTitle, width: 34, height: 48),
              title: Text(r.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(r.isReady ? 'Held until ${Fmt.date(r.holdUntil)}' : '#${r.position} in queue'),
              trailing: StatusChip(r.status, dense: true),
            ),
        ],
        if (past.isNotEmpty) ...[
          SectionHeader('History (${past.length})'),
          for (final l in past.take(10)) _loanTile(l),
        ],
      ],
    );
  }

  Widget _loanTile(Loan l) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: BookCover(title: l.bookTitle, width: 34, height: 48),
      title: Text(l.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        l.isReturned ? 'Returned ${Fmt.short(l.returnedAt)}' : '${l.copyId} · ${Fmt.dueLabel(l.dueAt)}',
        style: TextStyle(color: l.isReturned ? AppColors.muted : Fmt.dueTone(l.dueAt).fg),
      ),
      trailing: StatusChip(l.status, dense: true),
      onTap: () => showLoanSheet(context, l, actions: [
        if (!l.isReturned)
          (sheet) => FilledButton.icon(
                onPressed: () async {
                  Navigator.pop(sheet);
                  await openReturnFlow(context, l.copyId);
                  if (mounted) load();
                },
                icon: const Icon(Icons.undo),
                label: const Text('Process return'),
              ),
      ]),
    );
  }
}
