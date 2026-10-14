import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../librarian/loans_screen.dart';
import '../librarian/members_screen.dart';
import '../librarian/requests_screen.dart';
import 'audit_log_screen.dart';
import 'reports_screen.dart';
import 'settings_screen.dart';
import 'users_screen.dart';

/// Library management hub, opened from Profile.
class ManageScreen extends StatelessWidget {
  const ManageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    void push(Widget screen) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
    return Scaffold(
      appBar: AppBar(title: const Text('Manage', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          const _Group('People'),
          _Row(icon: Icons.manage_accounts_outlined, title: 'Users & roles', subtitle: 'Create, edit, deactivate or delete accounts', onTap: () => push(const UsersScreen())),
          _Row(icon: Icons.people_outline, title: 'Members', subtitle: 'Student memberships, suspend / renew', onTap: () => push(const MembersScreen())),
          const _Group('Circulation'),
          _Row(icon: Icons.assignment_outlined, title: 'Checkout requests', subtitle: 'Pending, approved and rejected checkouts', onTap: () => push(const RequestsScreen())),
          _Row(icon: Icons.swap_horiz, title: 'Loans & transactions', subtitle: 'Active, overdue and returned loans', onTap: () => push(const LoansScreen())),
          const _Group('System'),
          _Row(icon: Icons.insights_outlined, title: 'Reports', subtitle: 'Loans, returns, top books and categories', onTap: () => push(const ReportsScreen())),
          _Row(icon: Icons.policy_outlined, title: 'Policies & settings', subtitle: 'Borrowing limit, loan period, QR expiry…', onTap: () => push(const SettingsScreen())),
          _Row(icon: Icons.history, title: 'Audit log', subtitle: 'Who did what, and when', onTap: () => push(const AuditLogScreen())),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 6),
      child: Text(title.toUpperCase(),
          style: const TextStyle(fontSize: 12, letterSpacing: 0.6, fontWeight: FontWeight.w600, color: AppColors.muted)),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.title, required this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: AppColors.primaryText),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right, color: AppColors.faint),
      onTap: onTap,
    );
  }
}
