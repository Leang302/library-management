import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/state/auth_provider.dart';
import '../../core/theme.dart';
import '../../widgets/feedback.dart';
import '../common/server_url_dialog.dart';

class _DemoAccount {
  const _DemoAccount(this.label, this.login, this.password, this.icon);

  final String label;
  final String login;
  final String password;
  final IconData icon;
}

const _demoAccounts = [
  _DemoAccount('Student', 'student@library.com', 'student123', Icons.school_outlined),
  _DemoAccount('Librarian', 'librarian@library.com', 'library123', Icons.badge_outlined),
];

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final message = context.read<AuthProvider>().startupMessage;
    if (message != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showErrorText(context, message);
      });
    }
  }

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await context.read<AuthProvider>().login(_identifier.text, _password.text);
      // AuthGate swaps this screen for the role shell.
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _fill(_DemoAccount a) {
    setState(() {
      _identifier.text = a.login;
      _password.text = a.password;
    });
  }

  @override
  Widget build(BuildContext context) {
    final serverUrl = context.watch<AuthProvider>().serverUrl;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(20)),
                        child: const Icon(Icons.local_library_rounded, color: AppColors.primary, size: 40),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text('Greenleaf Library',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.text)),
                    const SizedBox(height: 4),
                    const Text('Sign in to borrow, return and manage books',
                        textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _identifier,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Email or student ID',
                        hintText: 'you@library.com or STU-10231',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your email or student ID' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _obscure ? 'Show password' : 'Hide password',
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
                    ),
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                          : const Text('Sign in'),
                    ),
                    const SizedBox(height: 28),
                    const Text('Demo accounts',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.muted)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final a in _demoAccounts)
                          ActionChip(
                            avatar: Icon(a.icon, size: 18, color: AppColors.primaryText),
                            label: Text(a.label),
                            onPressed: _busy ? null : () => _fill(a),
                          ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    TextButton.icon(
                      onPressed: () => showServerUrlDialog(context),
                      icon: const Icon(Icons.dns_outlined, size: 18),
                      label: Text('Server: $serverUrl', overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
