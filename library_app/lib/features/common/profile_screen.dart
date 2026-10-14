import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/user.dart';
import '../../core/state/auth_provider.dart';
import '../../core/state/shell_controller.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import '../librarian/loans_screen.dart';
import '../librarian/members_screen.dart';
import '../management/manage_screen.dart';
import '../student/member_card_screen.dart';
import 'notifications_screen.dart';
import 'server_url_dialog.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  static String roleLabel(String role) {
    switch (role) {
      case Roles.librarian:
        return 'Librarian';
      default:
        return 'Student';
    }
  }

  void _push(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

  Future<void> _signOut(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final ok = await confirmDialog(context,
        title: 'Sign out?', message: 'You will need to sign in again to use the app.', confirmText: 'Sign out', danger: true);
    if (!ok || !context.mounted) return;
    // Sign-out also unregisters this device from push, which can take a few
    // seconds on a slow network. The dialog is closed when the app returns to
    // the sign-in screen (every route is popped on sign-out).
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const PopScope(
        canPop: false,
        child: Center(child: CircularProgressIndicator()),
      ),
    );
    await auth.logout();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    if (user == null) return const SizedBox.shrink();
    final m = user.member;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: RefreshIndicator(
        onRefresh: () async {
          try {
            await auth.refreshUser();
          } catch (e) {
            if (context.mounted) showError(context, e);
          }
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          children: [
            Row(
              children: [
                InitialsAvatar(name: user.name, size: 64),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                      Text(user.email, style: const TextStyle(color: AppColors.muted)),
                      const SizedBox(height: 6),
                      StatusChip(user.role, label: user.title.isNotEmpty ? user.title : roleLabel(user.role)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (m != null) ...[
              InfoCard(children: [
                InfoRow(label: 'Student ID', value: m.studentId, icon: Icons.badge_outlined),
                InfoRow(label: 'Program', value: m.year == null ? m.program : '${m.program} · Year ${m.year}', icon: Icons.school_outlined),
                InfoRow(
                  label: 'Membership',
                  value: '',
                  icon: Icons.verified_user_outlined,
                  valueWidget: StatusChip(m.status, tone: m.canBorrow ? Tone.green : Tone.red, label: m.isExpired ? 'Expired' : null),
                ),
                InfoRow(label: 'Valid until', value: Fmt.date(m.expiresAt), icon: Icons.event_outlined),
              ]),
              const SizedBox(height: 12),
            ],
            if (user.phone.isNotEmpty)
              InfoCard(children: [InfoRow(label: 'Phone', value: user.phone, icon: Icons.phone_outlined)]),
            const SizedBox(height: 8),
            if (user.isStudent) ...[
              _Tile(icon: Icons.qr_code_2, title: 'Membership card', onTap: () => _push(context, const MemberCardScreen())),
              _Tile(
                icon: Icons.receipt_long_outlined,
                title: 'My receipts',
                onTap: () => context.read<ShellController>().openMyBooks(tabIndex: 3),
              ),
            ],
            if (user.isStaff) ...[
              _Tile(icon: Icons.people_outline, title: 'Members', onTap: () => _push(context, const MembersScreen())),
              _Tile(icon: Icons.swap_horiz, title: 'Loans & transactions', onTap: () => _push(context, const LoansScreen())),
              _Tile(icon: Icons.grid_view_outlined, title: 'Manage library', onTap: () => _push(context, const ManageScreen())),
            ],
            _Tile(icon: Icons.notifications_none, title: 'Notifications', onTap: () => _push(context, const NotificationsScreen())),
            _Tile(
              icon: Icons.dns_outlined,
              title: 'Server URL',
              subtitle: auth.serverUrl,
              onTap: () => showServerUrlDialog(context),
            ),
            const SizedBox(height: 8),
            _Tile(icon: Icons.logout, title: 'Sign out', danger: true, onTap: () => _signOut(context)),
            const SizedBox(height: 24),
            const Center(child: Text('Greenleaf Library · v1.0.0', style: TextStyle(color: AppColors.faint, fontSize: 12))),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.onTap, this.subtitle, this.danger = false});

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.red : AppColors.text;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Icon(icon, color: danger ? AppColors.red : AppColors.muted),
      title: Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w500)),
      subtitle: subtitle == null ? null : Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: danger ? null : const Icon(Icons.chevron_right, color: AppColors.faint),
      onTap: onTap,
    );
  }
}
