import 'package:flutter/material.dart';

import '../core/models/request.dart';
import '../core/theme.dart';

/// Bordered list of eligibility / policy checks with pass/fail icons.
class CheckList extends StatelessWidget {
  const CheckList({super.key, required this.checks, this.extra = const []});

  final List<Check> checks;

  /// Extra client-side checks appended at the end.
  final List<Check> extra;

  @override
  Widget build(BuildContext context) {
    final all = [...checks, ...extra];
    if (all.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Text('No checks to show.', style: TextStyle(color: AppColors.muted)),
      );
    }
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          for (var i = 0; i < all.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 44),
            _CheckRow(check: all[i]),
          ],
        ],
      ),
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({required this.check});

  final Check check;

  @override
  Widget build(BuildContext context) {
    final ok = check.ok;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ok ? Icons.check_circle : Icons.cancel,
              size: 20, color: ok ? AppColors.primary : AppColors.red),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(check.label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text)),
                if (check.detail.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(check.detail,
                        style: TextStyle(fontSize: 13, color: ok ? AppColors.muted : AppColors.red)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
