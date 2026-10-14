import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../core/utils/format.dart';

/// Small pill showing an API enum value (e.g. `OVERDUE` -> "Overdue" in red).
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key, this.label, this.tone, this.dense = false});

  final String? status;

  /// Overrides the text (defaults to a humanised [status]).
  final String? label;

  /// Overrides the colour (defaults to [toneForStatus]).
  final Tone? tone;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final t = tone ?? toneForStatus(status);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 6 : 8, vertical: dense ? 2 : 3),
      decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: t.fg, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(
            label ?? Fmt.enumLabel(status),
            style: TextStyle(color: t.fg, fontSize: dense ? 11 : 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
