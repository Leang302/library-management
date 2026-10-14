import 'package:flutter/material.dart';

import '../../core/api/api.dart';
import '../../core/models/management.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/empty_state.dart';

/// Audit events, newest first (`GET /audit-logs`, paged).
class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> with PagedLoader<AuditLogScreen, AuditLog> {
  late final ManagementService _mgmt = context.managementApi;
  final _filter = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _filter.dispose();
    super.dispose();
  }

  @override
  Future<PageResult<AuditLog>> fetchPage(int page) => _mgmt.auditLogs(page: page, size: 50);

  IconData _iconFor(String action) {
    final a = action.toUpperCase();
    if (a.contains('LOGIN')) return Icons.login;
    if (a.contains('APPROVE') || a.contains('CHECKOUT')) return Icons.check_circle_outline;
    if (a.contains('REJECT')) return Icons.cancel_outlined;
    if (a.contains('RETURN')) return Icons.undo;
    if (a.contains('USER')) return Icons.manage_accounts_outlined;
    if (a.contains('BOOK') || a.contains('COPY')) return Icons.menu_book_outlined;
    if (a.contains('SETTING')) return Icons.settings_outlined;
    return Icons.history;
  }

  @override
  Widget build(BuildContext context) {
    final q = _filter.text.trim().toLowerCase();
    return Scaffold(
      appBar: AppBar(title: const Text('Audit log')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _filter,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(hintText: 'Filter by action, user or detail', prefixIcon: Icon(Icons.filter_list)),
            ),
          ),
          Expanded(
            child: buildLoaded((all) {
              final list = q.isEmpty
                  ? all
                  : all
                      .where((l) =>
                          l.action.toLowerCase().contains(q) || l.detail.toLowerCase().contains(q) || l.userName.toLowerCase().contains(q))
                      .toList();
              return RefreshIndicator(
                onRefresh: load,
                child: list.isEmpty && !hasMore
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [EmptyState(icon: Icons.history, title: 'No activity')],
                      )
                    : infiniteScroll(ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                        itemCount: list.length + 1,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          if (i == list.length) return loadMoreFooter();
                          final l = list[i];
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(
                              backgroundColor: AppColors.bgMuted,
                              foregroundColor: AppColors.text2,
                              child: Icon(_iconFor(l.action), size: 20),
                            ),
                            title: Text(Fmt.enumLabel(l.action), style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('${l.detail}\n${l.userName.isEmpty ? 'System' : l.userName} · ${Fmt.dateTime(l.createdAt)}'),
                            isThreeLine: true,
                          );
                        },
                      )),
              );
            }),
          ),
        ],
      ),
    );
  }
}
