import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/management.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/mini_bar_chart.dart';
import '../common/notifications_screen.dart';
import '../librarian/book_manage_screen.dart';
import '../librarian/librarian_dashboard_screen.dart';
import '../librarian/loans_screen.dart';
import '../librarian/members_screen.dart';
import 'users_screen.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with Loader<ReportsScreen, Reports> {
  static const _ranges = [7, 30, 90, 365];

  late final ManagementService _mgmt = context.managementApi;
  late final RefreshBus _bus = context.read<RefreshBus>();
  int _days = 30;

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
  Future<Reports> fetch() => _mgmt.dashboard(days: _days);

  void _setRange(int d) {
    if (d == _days) return;
    setState(() => _days = d);
    load();
  }

  Future<void> _push(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    if (mounted) load();
  }

  String _rangeLabel(int d) => d == 365 ? '1Y' : '${d}D';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(Fmt.date(DateTime.now()), style: const TextStyle(fontSize: 13, color: AppColors.muted, fontWeight: FontWeight.w400)),
            const Text('Library overview', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Librarian desk',
            icon: const Icon(Icons.point_of_sale_outlined),
            onPressed: () => _push(const LibrarianDashboardScreen()),
          ),
          IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none),
            onPressed: () => _push(const NotificationsScreen()),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          FilterChips<int>(options: _ranges, selected: _days, onSelected: _setRange, labelOf: _rangeLabel),
          if (loading && data != null) const LinearProgressIndicator(minHeight: 2),
          Expanded(child: buildLoaded((d) => RefreshIndicator(onRefresh: load, child: _buildBody(d)))),
        ],
      ),
    );
  }

  Widget _buildBody(Reports s) {
    final shell = context.read<ShellController>();
    final maxTop = s.topBooks.fold<int>(1, (m, t) => t.count > m ? t.count : m);
    final maxCat = s.categories.fold<int>(1, (m, c) => c.count > m ? c.count : m);
    final period = _days == 365 ? 'last year' : 'last $_days days';
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
      children: [
        StatGrid(columns: 2, children: [
          StatTile(label: 'Borrowed books', value: '${s.borrowed}', sub: period, onTap: () => _push(const LoansScreen(initialStatus: 'ACTIVE'))),
          StatTile(label: 'Returned books', value: '${s.returned}', sub: period, onTap: () => _push(const LoansScreen(initialStatus: 'RETURNED'))),
          StatTile(label: 'Overdue books', value: '${s.overdue}', warn: s.overdue > 0, sub: 'right now', onTap: () => _push(const LoansScreen(initialStatus: 'OVERDUE'))),
          StatTile(label: 'Missing books', value: '${s.lost}', warn: s.lost > 0, sub: 'marked lost'),
          StatTile(label: 'Total copies', value: '${s.totalCopies}', sub: '${s.totalTitles} titles', onTap: () => shell.select(AppTab.books)),
          StatTile(label: 'Total titles', value: '${s.totalTitles}', onTap: () => shell.select(AppTab.books)),
          StatTile(label: 'Active members', value: '${s.activeMembers}', onTap: () => _push(const MembersScreen())),
          StatTile(label: 'New members', value: '${s.newMembers}', sub: period, onTap: () => _push(const UsersScreen())),
        ]),
        const SectionHeader('Most borrowed'),
        if (s.topBooks.isEmpty)
          const InlineEmpty(icon: Icons.bar_chart, text: 'No loans in this period')
        else
          for (final t in s.topBooks.take(8))
            InkWell(
              onTap: () => _push(BookManageScreen(bookId: t.bookId)),
              child: ProportionRow(label: t.title, value: t.count, max: maxTop),
            ),
        const SectionHeader('Loans by category'),
        if (s.categories.isEmpty)
          const InlineEmpty(icon: Icons.category_outlined, text: 'No data yet')
        else
          for (final c in s.categories) ProportionRow(label: c.name, value: c.count, max: maxCat, color: AppColors.brand),
      ],
    );
  }
}
