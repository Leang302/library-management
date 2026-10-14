import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/loan.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
import '../common/loan_sheet.dart';
import 'member_detail_screen.dart';
import 'return_screen.dart';

/// All loans (borrow transactions) with a status filter and search.
class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key, this.initialStatus = 'ALL'});

  /// `ALL` | `ACTIVE` | `OVERDUE` | `RETURNED`
  final String initialStatus;

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> with PagedLoader<LoansScreen, Loan> {
  static const _statuses = ['ALL', 'ACTIVE', 'OVERDUE', 'RETURNED'];

  late final DeskService _desk = context.deskApi;
  late final RefreshBus _bus = context.read<RefreshBus>();
  late String _status = widget.initialStatus;
  final _search = TextEditingController();

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
  Future<PageResult<Loan>> fetchPage(int page) => _desk.loans(status: _status, q: _search.text.trim(), page: page, size: 30);

  void _setStatus(String s) {
    if (s == _status) return;
    setState(() {
      _status = s;
      data = null;
    });
    load();
  }

  void _open(Loan l) {
    showLoanSheet(context, l, showMember: true, actions: [
      if (!l.isReturned)
        (sheet) => FilledButton.icon(
              onPressed: () {
                Navigator.pop(sheet);
                openReturnFlow(context, l.copyId);
              },
              icon: const Icon(Icons.undo),
              label: const Text('Process return'),
            ),
      (sheet) => OutlinedButton.icon(
            onPressed: () {
              Navigator.pop(sheet);
              Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MemberDetailScreen(memberId: l.memberId)));
            },
            icon: const Icon(Icons.person_outline),
            label: const Text('View member'),
          ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loans & transactions'),
            if (data != null)
              Text(Fmt.plural(totalElements, 'record'), style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
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
                hintText: 'Search book, member or copy ID',
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
          FilterChips<String>(
            options: _statuses,
            selected: _status,
            onSelected: _setStatus,
            labelOf: (s) => s == 'ALL' ? 'All' : Fmt.enumLabel(s),
          ),
          Expanded(
            child: buildLoaded((list) => RefreshIndicator(
                  onRefresh: load,
                  child: list.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            EmptyState(icon: Icons.search_off, title: 'No transactions', message: 'Try another filter or search term.'),
                          ],
                        )
                      : infiniteScroll(ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: list.length + 1,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            if (i == list.length) return loadMoreFooter();
                            final l = list[i];
                            final sub = l.isReturned
                                ? 'Returned ${Fmt.short(l.returnedAt)}${l.daysLate > 0 ? ' · ${l.daysLate}d late' : ''}'
                                : Fmt.dueLabel(l.dueAt);
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              onTap: () => _open(l),
                              leading: BookCover(title: l.bookTitle, width: 36, height: 50),
                              title: Text(l.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text('${l.memberName} · ${l.studentId}\n$sub',
                                  style: TextStyle(color: l.isReturned ? AppColors.muted : Fmt.dueTone(l.dueAt).fg)),
                              isThreeLine: true,
                              trailing: StatusChip(l.status, dense: true),
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
