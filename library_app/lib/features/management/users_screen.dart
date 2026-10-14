import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/user.dart';
import '../../core/state/auth_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/status_chip.dart';
import '../common/profile_screen.dart';
import 'user_form_screen.dart';

/// List, create, edit, deactivate and delete user accounts.
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> with PagedLoader<UsersScreen, User> {
  static const _roleFilters = ['ALL', Roles.student, Roles.librarian];

  late final ManagementService _mgmt = context.managementApi;
  final _search = TextEditingController();
  String _role = 'ALL';

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
  Future<PageResult<User>> fetchPage(int page) =>
      _mgmt.users(role: _role == 'ALL' ? null : _role, q: _search.text.trim(), page: page, size: 30);

  void _setRole(String r) {
    if (r == _role) return;
    setState(() {
      _role = r;
      data = null;
    });
    load();
  }

  Future<void> _openForm([User? user]) async {
    final saved = await Navigator.of(context).push<User>(MaterialPageRoute(builder: (_) => UserFormScreen(user: user)));
    if (saved != null && mounted) load();
  }

  Future<void> _setActive(User u, bool active) async {
    if (!active) {
      final ok = await confirmDialog(context,
          title: 'Deactivate ${u.name}?', message: 'They will no longer be able to sign in.', confirmText: 'Deactivate', danger: true);
      if (!ok || !mounted) return;
    }
    try {
      await _mgmt.updateUser(u.id, {
        'name': u.name,
        'email': u.email,
        'phone': u.phone,
        'title': u.title,
        'role': u.role,
        'active': active,
      });
      if (!mounted) return;
      showSuccess(context, active ? '${u.name} reactivated' : '${u.name} deactivated');
      load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _delete(User u) async {
    final ok = await confirmDialog(context,
        title: 'Delete this account?', message: '${u.name} (${u.email}) will be removed. This cannot be undone.', confirmText: 'Delete', danger: true);
    if (!ok || !mounted) return;
    try {
      await _mgmt.deleteUser(u.id);
      if (!mounted) return;
      showSuccess(context, 'Account deleted');
      load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  void _actions(User u) {
    final me = context.read<AuthProvider>().user;
    final isMe = me?.id == u.id;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: InitialsAvatar(name: u.name),
              title: Text(u.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(u.email),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Edit account'),
              onTap: () {
                Navigator.pop(sheet);
                _openForm(u);
              },
            ),
            if (!isMe)
              ListTile(
                leading: Icon(u.active ? Icons.block : Icons.check_circle_outline, color: u.active ? AppColors.amber : AppColors.primary),
                title: Text(u.active ? 'Deactivate' : 'Reactivate'),
                onTap: () {
                  Navigator.pop(sheet);
                  _setActive(u, !u.active);
                },
              ),
            if (!isMe)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.red),
                title: const Text('Delete account', style: TextStyle(color: AppColors.red)),
                onTap: () {
                  Navigator.pop(sheet);
                  _delete(u);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Users'),
            if (data != null)
              Text(Fmt.plural(totalElements, 'account'), style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(tooltip: 'Add user', icon: const Icon(Icons.person_add_alt_1_outlined), onPressed: () => _openForm()),
        ],
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
                hintText: 'Name or email',
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
            options: _roleFilters,
            selected: _role,
            onSelected: _setRole,
            labelOf: (r) => r == 'ALL' ? 'All' : ProfileScreen.roleLabel(r),
          ),
          Expanded(
            child: buildLoaded((list) => RefreshIndicator(
                  onRefresh: load,
                  child: list.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [EmptyState(icon: Icons.person_off_outlined, title: 'No users found')],
                        )
                      : infiniteScroll(ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: list.length + 1,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            if (i == list.length) return loadMoreFooter();
                            final u = list[i];
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              onTap: () => _actions(u),
                              leading: Opacity(opacity: u.active ? 1 : 0.45, child: InitialsAvatar(name: u.name)),
                              title: Text(u.name,
                                  style: TextStyle(fontWeight: FontWeight.w600, color: u.active ? AppColors.text : AppColors.muted)),
                              subtitle: Text(u.member != null ? '${u.email}\n${u.member!.studentId}' : u.email),
                              isThreeLine: u.member != null,
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  StatusChip(u.role, label: ProfileScreen.roleLabel(u.role), dense: true),
                                  if (!u.active) ...[
                                    const SizedBox(height: 4),
                                    const StatusChip('SUSPENDED', label: 'Inactive', dense: true),
                                  ],
                                ],
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
