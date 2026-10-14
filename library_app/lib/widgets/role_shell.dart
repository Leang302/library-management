import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api/api.dart';
import '../core/models/user.dart';
import '../core/state/cart_provider.dart';
import '../core/state/shell_controller.dart';
import '../core/theme.dart';
import '../features/common/profile_screen.dart';
import '../features/librarian/books_inventory_screen.dart';
import '../features/librarian/librarian_dashboard_screen.dart';
import '../features/librarian/requests_screen.dart';
import '../features/librarian/universal_scan_screen.dart';
import '../features/student/explore_screen.dart';
import '../features/student/my_books_screen.dart';
import '../features/student/student_home_screen.dart';
import '../features/student/student_scan_screen.dart';

class ShellTab {
  const ShellTab({required this.id, required this.label, required this.icon, required this.activeIcon, required this.builder});

  final String id;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final WidgetBuilder builder;
}

/// Role-aware bottom navigation: four tabs with a raised circular Scan button
/// docked in the middle of the bar.
///
/// - Student:   Home · Explore · [Scan] · My Books · Profile
/// - Librarian: Dashboard · Requests · [Scan] · Books · Profile
///   (library management — users, policies, reports — is under Profile › Manage)
class RoleShell extends StatefulWidget {
  const RoleShell({super.key, required this.user});

  final User user;

  static List<ShellTab> tabsFor(User user) {
    final profile = ShellTab(
      id: AppTab.profile,
      label: 'Profile',
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      builder: (_) => const ProfileScreen(),
    );
    if (user.isStudent) {
      return [
        ShellTab(id: AppTab.home, label: 'Home', icon: Icons.home_outlined, activeIcon: Icons.home, builder: (_) => const StudentHomeScreen()),
        ShellTab(id: AppTab.explore, label: 'Explore', icon: Icons.explore_outlined, activeIcon: Icons.explore, builder: (_) => const ExploreScreen()),
        ShellTab(id: AppTab.myBooks, label: 'My Books', icon: Icons.menu_book_outlined, activeIcon: Icons.menu_book, builder: (_) => const MyBooksScreen()),
        profile,
      ];
    }
    return [
      ShellTab(id: AppTab.dashboard, label: 'Dashboard', icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, builder: (_) => const LibrarianDashboardScreen()),
      ShellTab(id: AppTab.requests, label: 'Requests', icon: Icons.assignment_outlined, activeIcon: Icons.assignment, builder: (_) => const RequestsScreen()),
      ShellTab(id: AppTab.books, label: 'Books', icon: Icons.library_books_outlined, activeIcon: Icons.library_books, builder: (_) => const BooksInventoryScreen()),
      profile,
    ];
  }

  @override
  State<RoleShell> createState() => _RoleShellState();
}

class _RoleShellState extends State<RoleShell> {
  late final List<ShellTab> _tabs = RoleShell.tabsFor(widget.user);

  /// Tabs are built lazily the first time they are opened, then kept alive.
  final Set<int> _built = {0};

  @override
  void initState() {
    super.initState();
    context.read<ShellController>().resetSilently();
    if (widget.user.isStudent) {
      context.read<CartProvider>().refresh(StudentService(context.read<ApiClient>()));
    }
  }

  void _openScanner() {
    final Widget screen = widget.user.isStudent ? const StudentScanScreen() : const UniversalScanScreen();
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final shell = context.watch<ShellController>();
    var index = _tabs.indexWhere((t) => t.id == shell.tab);
    if (index < 0) index = 0;
    _built.add(index);
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          for (var i = 0; i < _tabs.length; i++)
            KeyedSubtree(
              key: ValueKey(_tabs[i].id),
              child: _built.contains(i) ? _tabs[i].builder(context) : const SizedBox.shrink(),
            ),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: keyboardOpen ? null : _ScanFab(onPressed: _openScanner),
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 7,
        height: 66,
        padding: EdgeInsets.zero,
        color: AppColors.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 10,
        shadowColor: Colors.black26,
        child: Row(
          children: [
            _TabItem(tab: _tabs[0], selected: index == 0, onTap: () => shell.select(_tabs[0].id)),
            _TabItem(tab: _tabs[1], selected: index == 1, onTap: () => shell.select(_tabs[1].id)),
            const Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: 9),
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Text('Scan', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primaryText)),
                ),
              ),
            ),
            _TabItem(tab: _tabs[2], selected: index == 2, onTap: () => shell.select(_tabs[2].id)),
            _TabItem(tab: _tabs[3], selected: index == 3, onTap: () => shell.select(_tabs[3].id)),
          ],
        ),
      ),
    );
  }
}

class _ScanFab extends StatelessWidget {
  const _ScanFab({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      height: 64,
      child: FloatingActionButton(
        heroTag: 'scan-fab',
        tooltip: 'Scan',
        onPressed: onPressed,
        shape: const CircleBorder(),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        child: const Icon(Icons.qr_code_scanner_rounded, size: 30),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({required this.tab, required this.selected, required this.onTap});

  final ShellTab tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primaryText : AppColors.muted;
    return Expanded(
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? tab.activeIcon : tab.icon, color: color, size: 24),
            const SizedBox(height: 3),
            Text(
              tab.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, fontWeight: selected ? FontWeight.w600 : FontWeight.w500, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
