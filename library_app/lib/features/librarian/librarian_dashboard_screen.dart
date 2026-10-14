import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/auth_provider.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/mini_bar_chart.dart';
import '../common/loan_sheet.dart';
import '../common/notifications_screen.dart';
import 'book_form_screen.dart';
import 'loans_screen.dart';
import 'members_screen.dart';
import 'request_review_screen.dart';
import 'requests_screen.dart';
import 'return_screen.dart';
import 'universal_scan_screen.dart';

class _DeskData {
  const _DeskData(this.dash, this.unread);
  final LibrarianDashboard dash;
  final int unread;
}

class LibrarianDashboardScreen extends StatefulWidget {
  const LibrarianDashboardScreen({super.key});

  @override
  State<LibrarianDashboardScreen> createState() => _LibrarianDashboardScreenState();
}

class _LibrarianDashboardScreenState extends State<LibrarianDashboardScreen> with Loader<LibrarianDashboardScreen, _DeskData> {
  late final DeskService _desk = context.deskApi;
  late final NotificationService _notifications = context.notificationsApi;
  late final RefreshBus _bus = context.read<RefreshBus>();

  @override
  void initState() {
    super.initState();
    _bus.addListener(load);
    load();
  }

  @override
  void dispose() {
    _bus.removeListener(load);
    super.dispose();
  }

  @override
  Future<_DeskData> fetch() async {
    final r = await Future.wait<dynamic>([
      _desk.dashboard(),
      _notifications.unreadCount().catchError((Object _) => 0),
    ]);
    return _DeskData(r[0] as LibrarianDashboard, r[1] as int);
  }

  Future<void> _push(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    if (mounted) load();
  }

  void _openRequests() {
    final user = context.read<AuthProvider>().user;
    if (user != null && user.isLibrarian) {
      context.read<ShellController>().select(AppTab.requests);
    } else {
      _push(const RequestsScreen());
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
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
          BadgeIconButton(
            icon: Icons.notifications_none,
            count: data?.unread ?? 0,
            tooltip: 'Notifications',
            onPressed: () => _push(const NotificationsScreen()),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d.dash))),
    );
  }

  Widget _buildBody(LibrarianDashboard s) {
    final shell = context.read<ShellController>();
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
      children: [
        FilledButton.icon(
          onPressed: () => _push(const UniversalScanScreen(initialMode: ScanMode.checkout)),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan checkout QR'),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _push(const UniversalScanScreen(initialMode: ScanMode.returnBook)),
                icon: const Icon(Icons.undo),
                label: const Text('Process return'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _push(const BookFormScreen()),
                icon: const Icon(Icons.add),
                label: const Text('Add book'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        StatGrid(columns: 3, children: [
          StatTile(label: 'Borrowed today', value: '${s.borrowedToday}', onTap: () => _push(const LoansScreen(initialStatus: 'ACTIVE'))),
          StatTile(label: 'Returned today', value: '${s.returnedToday}', onTap: () => _push(const LoansScreen(initialStatus: 'RETURNED'))),
          StatTile(label: 'Pending', value: '${s.pending}', onTap: _openRequests),
          StatTile(label: 'Overdue', value: '${s.overdue}', warn: s.overdue > 0, onTap: () => _push(const LoansScreen(initialStatus: 'OVERDUE'))),
          StatTile(label: 'Active members', value: '${s.activeMembers}', onTap: () => _push(const MembersScreen())),
          StatTile(label: 'Available', value: '${s.availableCopies}', onTap: () => shell.select(AppTab.books)),
        ]),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
          decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Checkouts this week', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              const Text('Borrowed vs returned', style: TextStyle(color: AppColors.muted, fontSize: 12)),
              const SizedBox(height: 12),
              MiniBarChart(days: s.last7),
            ],
          ),
        ),
        SectionHeader('Pending approvals (${s.pendingRequests.length})', onAction: s.pendingRequests.isEmpty ? null : _openRequests),
        if (s.pendingRequests.isEmpty)
          const InlineEmpty(icon: Icons.check_circle_outline, text: 'No checkouts waiting')
        else
          for (final r in s.pendingRequests.take(5)) PendingRequestTile(request: r, onTap: () => _push(RequestReviewScreen(requestId: r.id))),
        if (s.dueToday.isNotEmpty) ...[
          SectionHeader('Due today (${s.dueToday.length})'),
          for (final l in s.dueToday)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: BookCover(title: l.bookTitle, width: 34, height: 48),
              title: Text(l.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('${l.memberName} · ${l.copyId}'),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.amber50, borderRadius: BorderRadius.circular(20)),
                child: const Text('Today', style: TextStyle(color: AppColors.amber, fontWeight: FontWeight.w600, fontSize: 12)),
              ),
              onTap: () => showLoanSheet(context, l, showMember: true, actions: [
                (sheet) => FilledButton.icon(
                      onPressed: () {
                        Navigator.pop(sheet);
                        openReturnFlow(context, l.copyId);
                      },
                      icon: const Icon(Icons.undo),
                      label: const Text('Process return'),
                    ),
              ]),
            ),
        ],
      ],
    );
  }
}

/// Row for a pending checkout request with a "minutes left" badge.
class PendingRequestTile extends StatelessWidget {
  const PendingRequestTile({super.key, required this.request, required this.onTap});

  final BorrowRequest request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = request;
    final exp = r.expiresAt;
    final mins = exp == null ? null : exp.difference(DateTime.now()).inMinutes;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: InitialsAvatar(name: r.memberName),
      title: Text(r.memberName, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text('${r.code} · ${Fmt.plural(r.items.length, 'book')} · ${Fmt.relative(r.requestedAt)}'),
      trailing: r.isPending && mins != null
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.amber50, borderRadius: BorderRadius.circular(20)),
              child: Text(mins <= 0 ? 'Expiring' : '${mins}m left',
                  style: const TextStyle(color: AppColors.amber, fontWeight: FontWeight.w600, fontSize: 12)),
            )
          : const Icon(Icons.chevron_right),
    );
  }
}
