import 'package:flutter/material.dart';

import '../core/api/api_client.dart';
import '../core/theme.dart';

void _show(BuildContext context, String message, {required Color color, required IconData icon}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      backgroundColor: color,
      content: Row(
        children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
        ],
      ),
    ));
}

void showSuccess(BuildContext context, String message) =>
    _show(context, message, color: AppColors.primaryPress, icon: Icons.check_circle_outline);

void showInfo(BuildContext context, String message) =>
    _show(context, message, color: AppColors.text, icon: Icons.info_outline);

/// Shows [ApiException.message] (or a generic message) in a red SnackBar.
void showError(BuildContext context, Object error) =>
    _show(context, errorMessage(error), color: AppColors.red, icon: Icons.error_outline);

void showErrorText(BuildContext context, String message) =>
    _show(context, message, color: AppColors.red, icon: Icons.error_outline);

/// Simple yes/no dialog. Returns true when confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  String? message,
  String confirmText = 'Confirm',
  String cancelText = 'Cancel',
  bool danger = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: message == null ? null : Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(cancelText)),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: AppColors.red, minimumSize: const Size(0, 40)) : FilledButton.styleFrom(minimumSize: const Size(0, 40)),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmText),
        ),
      ],
    ),
  );
  return result ?? false;
}
