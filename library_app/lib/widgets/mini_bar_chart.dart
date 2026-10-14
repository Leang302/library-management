import 'package:flutter/material.dart';

import '../core/models/desk.dart';
import '../core/theme.dart';

/// Grouped bar chart (borrowed vs returned per day) drawn with plain widgets.
class MiniBarChart extends StatelessWidget {
  const MiniBarChart({super.key, required this.days, this.height = 140});

  final List<DayStat> days;
  final double height;

  static const borrowedColor = AppColors.primary;
  static const returnedColor = Color(0xFFA9D8B2);

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(child: Text('No activity yet', style: TextStyle(color: AppColors.muted))),
      );
    }
    var max = 1;
    for (final d in days) {
      if (d.borrowed > max) max = d.borrowed;
      if (d.returned > max) max = d.returned;
    }
    const labelH = 18.0;
    const valueH = 14.0;
    final barArea = height - labelH - valueH;

    Widget bar(int value, Color color) => Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: valueH,
                child: value > 0
                    ? Text('$value', style: const TextStyle(fontSize: 9, color: AppColors.muted))
                    : null,
              ),
              Container(
                height: value == 0 ? 2 : (value / max) * barArea,
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                decoration: BoxDecoration(
                  color: value == 0 ? AppColors.border : color,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                ),
              ),
            ],
          ),
        );

    return Column(
      children: [
        SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final d in days)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    child: Column(
                      children: [
                        Expanded(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [bar(d.borrowed, borrowedColor), bar(d.returned, returnedColor)],
                          ),
                        ),
                        SizedBox(
                          height: labelH,
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            child: Text(d.label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _Legend(color: borrowedColor, label: 'Borrowed'),
            SizedBox(width: 16),
            _Legend(color: returnedColor, label: 'Returned'),
          ],
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ],
    );
  }
}

/// Horizontal proportion bar used for "top books" and "categories" lists.
class ProportionRow extends StatelessWidget {
  const ProportionRow({super.key, required this.label, required this.value, required this.max, this.color = AppColors.primary});

  final String label;
  final int value;
  final int max;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final frac = max <= 0 ? 0.0 : (value / max).clamp(0.0, 1.0).toDouble();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 8),
              Text('$value', style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: frac,
              minHeight: 6,
              backgroundColor: AppColors.bgMuted,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
}
