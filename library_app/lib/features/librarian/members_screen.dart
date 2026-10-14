import 'package:flutter/material.dart';

import '../../core/api/api.dart';
import '../../core/models/user.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
import 'member_detail_screen.dart';
import 'universal_scan_screen.dart';

class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> with PagedLoader<MembersScreen, Member> {
  late final DeskService _desk = context.deskApi;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Future<PageResult<Member>> fetchPage(int page) => _desk.members(q: _search.text.trim(), page: page, size: 30);

  Future<void> _open(Member m) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MemberDetailScreen(memberId: m.id)));
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Members'),
            if (data != null)
              Text(Fmt.plural(totalElements, 'student'), style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Scan membership card',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute<void>(builder: (_) => const UniversalScanScreen(initialMode: ScanMode.member))),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => load(),
              decoration: InputDecoration(
                hintText: 'Name, email or student ID',
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
          Expanded(
            child: buildLoaded((list) => RefreshIndicator(
                  onRefresh: load,
                  child: list.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [EmptyState(icon: Icons.person_off_outlined, title: 'No members found')],
                        )
                      : infiniteScroll(ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: list.length + 1,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            if (i == list.length) return loadMoreFooter();
                            final m = list[i];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              onTap: () => _open(m),
                              leading: InitialsAvatar(name: m.name),
                              title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${m.studentId} · ${m.program}\n${m.activeLoans} on loan${m.overdueLoans > 0 ? ' · ${m.overdueLoans} overdue' : ''}'),
                              isThreeLine: true,
                              trailing: StatusChip(
                                m.status,
                                tone: m.canBorrow ? Tone.green : Tone.red,
                                label: m.isExpired && !m.isSuspended ? 'Expired' : null,
                                dense: true,
                              ),
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
