import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/notification.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import 'notification_links.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> with PagedLoader<NotificationsScreen, AppNotification> {
  late final NotificationService _service = context.notificationsApi;
  late final RefreshBus _bus = context.read<RefreshBus>();

  @override
  void initState() {
    super.initState();
    // A push arriving while this screen is open reloads it.
    _bus.addListener(load);
    load();
  }

  @override
  void dispose() {
    _bus.removeListener(load);
    super.dispose();
  }

  @override
  Future<PageResult<AppNotification>> fetchPage(int page) => _service.list(page: page, size: 20);

  /// Marks the item read and opens what it links to (same targets as a tapped push).
  Future<void> _open(AppNotification n) async {
    if (!n.read) {
      setState(() => data = [for (final x in data ?? <AppNotification>[]) x.id == n.id ? x.copyWith(read: true) : x]);
      // Non-critical; the next refresh shows the real state.
      _service.markRead(n.id).catchError((Object _) {});
    }
    if (n.linkTo == null) return;
    await openNotificationLink(Navigator.of(context), linkTo: n.linkTo, linkId: n.linkId, fallbackToList: false);
  }

  Future<void> _markAll() async {
    try {
      await _service.markAllRead();
      if (!mounted) return;
      setState(() => data = [for (final x in data ?? <AppNotification>[]) x.copyWith(read: true)]);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  IconData _iconFor(String type) {
    if (type.contains('APPROVED')) return Icons.check_circle_outline;
    if (type.contains('REJECT')) return Icons.cancel_outlined;
    if (type.contains('RETURN') || type.contains('RECEIPT')) return Icons.receipt_long_outlined;
    if (type.contains('RESERV') || type.contains('READY')) return Icons.bookmark_added_outlined;
    if (type.contains('DUE') || type.contains('OVERDUE')) return Icons.schedule;
    return Icons.notifications_none;
  }

  @override
  Widget build(BuildContext context) {
    final unread = (data ?? const <AppNotification>[]).where((n) => !n.read).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unread > 0) TextButton(onPressed: _markAll, child: const Text('Mark all read')),
        ],
      ),
      body: buildLoaded((list) => RefreshIndicator(
            onRefresh: load,
            child: list.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      EmptyState(icon: Icons.notifications_none, title: 'No notifications', message: 'Updates about your checkouts, returns and reservations appear here.'),
                    ],
                  )
                : infiniteScroll(ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: list.length + 1,
                    separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
                    itemBuilder: (context, i) {
                      if (i == list.length) return loadMoreFooter();
                      final n = list[i];
                      return ListTile(
                        onTap: () => _open(n),
                        tileColor: n.read ? null : AppColors.primary50,
                        leading: CircleAvatar(
                          backgroundColor: n.read ? AppColors.bgMuted : AppColors.primary100,
                          foregroundColor: n.read ? AppColors.muted : AppColors.primaryText,
                          child: Icon(_iconFor(n.type), size: 20),
                        ),
                        title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w700)),
                        subtitle: Text('${n.body}\n${Fmt.relative(n.createdAt)}'),
                        isThreeLine: true,
                        trailing: n.linkTo == null ? null : const Icon(Icons.chevron_right, color: AppColors.faint),
                      );
                    },
                  )),
          )),
    );
  }
}
