import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
import 'librarian_dashboard_screen.dart';
import 'request_review_screen.dart';

/// Checkout requests by status (librarian tab).
class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> with Loader<RequestsScreen, List<BorrowRequest>> {
  late final DeskService _desk = context.deskApi;
  late final RefreshBus _bus = context.read<RefreshBus>();
  String _status = RequestStatus.pending;

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
  Future<List<BorrowRequest>> fetch() async {
    // Pending: oldest first (first come, first served). Others: newest first.
    final pending = _status == RequestStatus.pending;
    final page = await _desk.requests(status: _status, direction: pending ? 'ASC' : 'DESC', size: ApiClient.maxPageSize);
    final list = List<BorrowRequest>.of(page.items);
    list.sort((a, b) {
      final ta = a.requestedAt ?? DateTime(0);
      final tb = b.requestedAt ?? DateTime(0);
      return pending ? ta.compareTo(tb) : tb.compareTo(ta);
    });
    return list;
  }

  void _setStatus(String s) {
    if (s == _status) return;
    setState(() {
      _status = s;
      data = null;
    });
    load();
  }

  Future<void> _open(BorrowRequest r) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RequestReviewScreen(requestId: r.id)));
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      appBar: AppBar(
        title: Text('Checkout requests', style: TextStyle(fontSize: canPop ? 17 : 22, fontWeight: canPop ? FontWeight.w600 : FontWeight.w700)),
      ),
      body: Column(
        children: [
          FilterChips<String>(
            options: RequestStatus.all,
            selected: _status,
            onSelected: _setStatus,
            labelOf: (s) => s == RequestStatus.pending ? 'Pending' : Fmt.enumLabel(s),
          ),
          Expanded(
            child: buildLoaded((list) => RefreshIndicator(
                  onRefresh: load,
                  child: list.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            EmptyState(
                              icon: Icons.assignment_turned_in_outlined,
                              title: _status == RequestStatus.pending ? 'No checkouts waiting' : 'No ${Fmt.enumLabel(_status).toLowerCase()} requests',
                              message: _status == RequestStatus.pending ? 'Students’ checkout QRs show up here until they are approved.' : null,
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                          itemCount: list.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final r = list[i];
                            if (r.isPending) return PendingRequestTile(request: r, onTap: () => _open(r));
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              onTap: () => _open(r),
                              leading: InitialsAvatar(name: r.memberName),
                              title: Text(r.memberName, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${r.code} · ${Fmt.plural(r.items.length, 'book')} · ${Fmt.dateTime(r.processedAt ?? r.requestedAt)}'),
                              trailing: StatusChip(r.status, dense: true),
                            );
                          },
                        ),
                )),
          ),
        ],
      ),
    );
  }
}
