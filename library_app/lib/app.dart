import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api/api_client.dart';
import 'core/push/push_service.dart';
import 'core/state/auth_provider.dart';
import 'core/state/cart_provider.dart';
import 'core/state/refresh_bus.dart';
import 'core/state/shell_controller.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/common/notification_links.dart';
import 'widgets/role_shell.dart';

/// Root navigator, also used to open screens from tapped push notifications.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

class LibraryApp extends StatefulWidget {
  const LibraryApp({super.key, required this.api, required this.auth});

  final ApiClient api;
  final AuthProvider auth;

  @override
  State<LibraryApp> createState() => _LibraryAppState();
}

class _LibraryAppState extends State<LibraryApp> {
  final _cart = CartProvider();
  final _shell = ShellController();
  final _bus = RefreshBus();
  AuthStatus? _lastStatus;

  PushService get _push => widget.auth.push;

  @override
  void initState() {
    super.initState();
    widget.auth.addListener(_onAuthChanged);
    _push.onForegroundMessage = (_) => _bus.bump();
    _push.setOpenHandler(_onPushOpened);
    // A tap that launched the app is handled once the session is known.
    _onAuthChanged();
  }

  @override
  void dispose() {
    widget.auth.removeListener(_onAuthChanged);
    _push.onForegroundMessage = null;
    _push.setOpenHandler(null);
    _cart.dispose();
    _shell.dispose();
    _bus.dispose();
    super.dispose();
  }

  /// On sign-out (manual or expired token) drop every pushed screen and per-user state.
  void _onAuthChanged() {
    final status = widget.auth.status;
    if (status == _lastStatus) return;
    _lastStatus = status;
    if (status == AuthStatus.signedOut) {
      _push.discardPendingOpen();
      rootNavigatorKey.currentState?.popUntil((route) => route.isFirst);
      _cart.clear();
      _shell.resetSilently();
    } else if (status == AuthStatus.signedIn) {
      // Wait for the role shell to mount before navigating.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.auth.status == AuthStatus.signedIn) _push.flushPendingOpen();
      });
    }
  }

  /// A push (or its local notification) was tapped.
  void _onPushOpened(Map<String, dynamic> data) {
    switch (widget.auth.status) {
      case AuthStatus.loading:
        _push.deferOpen(data); // opened when the session is restored
        return;
      case AuthStatus.signedOut:
        return; // never act on a push while nobody is signed in
      case AuthStatus.signedIn:
        _bus.bump();
        final nav = rootNavigatorKey.currentState;
        if (nav == null) {
          _push.deferOpen(data);
          return;
        }
        openNotificationLink(
          nav,
          linkTo: data['linkTo']?.toString(),
          linkId: data['linkId']?.toString(),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: widget.api),
        ChangeNotifierProvider<AuthProvider>.value(value: widget.auth),
        ChangeNotifierProvider<CartProvider>.value(value: _cart),
        ChangeNotifierProvider<ShellController>.value(value: _shell),
        ChangeNotifierProvider<RefreshBus>.value(value: _bus),
      ],
      child: MaterialApp(
        title: 'Greenleaf Library',
        debugShowCheckedModeBanner: false,
        navigatorKey: rootNavigatorKey,
        theme: buildAppTheme(),
        home: const AuthGate(),
      ),
    );
  }
}

/// Splash while restoring the session, then login or the role shell.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    switch (auth.status) {
      case AuthStatus.loading:
        return const _Splash();
      case AuthStatus.signedOut:
        return const LoginScreen();
      case AuthStatus.signedIn:
        if (user == null) return const LoginScreen();
        return RoleShell(key: ValueKey('${user.id}-${user.role}'), user: user);
    }
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_library_rounded, size: 56, color: AppColors.primary),
            SizedBox(height: 16),
            Text('Greenleaf Library', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            SizedBox(height: 24),
            SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}
