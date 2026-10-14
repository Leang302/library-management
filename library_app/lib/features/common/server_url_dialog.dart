import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/state/auth_provider.dart';
import '../../widgets/feedback.dart';

/// Lets the user point the app at a different backend (stored in shared_preferences).
Future<void> showServerUrlDialog(BuildContext context) async {
  final auth = context.read<AuthProvider>();
  final saved = await showDialog<bool>(
    context: context,
    builder: (_) => _ServerUrlDialog(auth: auth),
  );
  if (saved == true && context.mounted) showSuccess(context, 'Server URL saved');
}

class _ServerUrlDialog extends StatefulWidget {
  const _ServerUrlDialog({required this.auth});

  final AuthProvider auth;

  @override
  State<_ServerUrlDialog> createState() => _ServerUrlDialogState();
}

class _ServerUrlDialogState extends State<_ServerUrlDialog> {
  late final TextEditingController _url = TextEditingController(text: widget.auth.serverUrl);
  String? _error;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v = _url.text.trim();
    final uri = Uri.tryParse(v);
    if (uri == null || !(uri.isScheme('http') || uri.isScheme('https')) || uri.host.isEmpty) {
      setState(() => _error = 'Enter a full URL, e.g. http://10.0.2.2:8081/api/v1');
      return;
    }
    await widget.auth.setServerUrl(v);
    if (mounted) Navigator.pop(context, true);
  }

  Future<void> _reset() async {
    await widget.auth.resetServerUrl();
    if (!mounted) return;
    setState(() {
      _url.text = widget.auth.serverUrl;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Server URL'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Base URL of the Greenleaf Library API, including /api/v1.'),
          const SizedBox(height: 12),
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: InputDecoration(errorText: _error, hintText: AuthProvider.defaultServerUrl()),
            onSubmitted: (_) => _save(),
          ),
          const SizedBox(height: 8),
          Text('Default: ${AuthProvider.defaultServerUrl()}', style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      actions: [
        TextButton(onPressed: _reset, child: const Text('Reset')),
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
          onPressed: _save,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
