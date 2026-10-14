import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../core/utils/format.dart';

/// Section title with an optional "See all" style action.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction, this.padding});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(0, 20, 0, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
          ),
          if (onAction != null)
            InkWell(
              onTap: onAction,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Text(actionLabel ?? 'See all',
                    style: const TextStyle(color: AppColors.primaryText, fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ),
        ],
      ),
    );
  }
}

/// Number + label tile used on dashboards.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.warn = false, this.sub, this.onTap});

  final String label;
  final String value;
  final bool warn;
  final String? sub;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: warn ? AppColors.red50 : AppColors.bgSubtle,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(value,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: warn ? AppColors.red : AppColors.text)),
              const SizedBox(height: 2),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              if (sub != null)
                Text(sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.faint)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Grid of [StatTile]s with a fixed number of columns.
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children, this.columns = 3});

  final List<Widget> children;
  final int columns;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      final cells = <Widget>[];
      for (var c = 0; c < columns; c++) {
        if (c > 0) cells.add(const SizedBox(width: 8));
        final idx = i + c;
        cells.add(Expanded(child: idx < children.length ? children[idx] : const SizedBox.shrink()));
      }
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 8));
      rows.add(IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells)));
    }
    return Column(children: rows);
  }
}

/// Label/value row for detail cards.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.icon, this.valueWidget});

  final String label;
  final String value;
  final IconData? icon;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 18, color: AppColors.faint), const SizedBox(width: 10)],
          Text(label, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(width: 12),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: valueWidget ??
                  Text(value,
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.text)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bordered container used to group related facts.
class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.children, this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 4)});

  final List<Widget> children;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
  }
}

/// Circle with the person's initials.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.size = 40});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: AppColors.primary100, shape: BoxShape.circle),
      child: Text(
        Fmt.initials(name),
        style: TextStyle(color: AppColors.primaryText, fontWeight: FontWeight.w700, fontSize: size * 0.36),
      ),
    );
  }
}

/// Coloured call-to-action banner (e.g. "Checkout QR ready").
class ToneBanner extends StatelessWidget {
  const ToneBanner({super.key, required this.tone, required this.icon, required this.title, this.subtitle, this.onTap});

  final Tone tone;
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tone.bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(icon, color: tone.fg),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: tone.fg)),
                    if (subtitle != null)
                      Text(subtitle!, style: const TextStyle(fontSize: 13, color: AppColors.text2)),
                  ],
                ),
              ),
              if (onTap != null) Icon(Icons.chevron_right, color: tone.fg),
            ],
          ),
        ),
      ),
    );
  }
}

/// Icon button with a numeric badge (cart, notifications).
class BadgeIconButton extends StatelessWidget {
  const BadgeIconButton({super.key, required this.icon, required this.count, required this.onPressed, this.tooltip});

  final IconData icon;
  final int count;
  final VoidCallback onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Badge(
        isLabelVisible: count > 0,
        backgroundColor: AppColors.red,
        label: Text(count > 99 ? '99+' : '$count'),
        child: Icon(icon),
      ),
    );
  }
}

/// Large success / failure mark used on result screens.
class ResultMark extends StatelessWidget {
  const ResultMark({super.key, required this.ok, this.size = 72});

  final bool ok;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: ok ? AppColors.primary50 : AppColors.red50, shape: BoxShape.circle),
      child: Icon(ok ? Icons.check_rounded : Icons.close_rounded, size: size * 0.55, color: ok ? AppColors.primary : AppColors.red),
    );
  }
}

/// Bottom bar for primary actions (sticky footer).
class BottomActions extends StatelessWidget {
  const BottomActions({super.key, required this.children, this.top});

  final List<Widget> children;
  final Widget? top;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (top != null) ...[top!, const SizedBox(height: 8)],
              Row(
                children: [
                  for (var i = 0; i < children.length; i++) ...[
                    if (i > 0) const SizedBox(width: 10),
                    children[i],
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal row of single-select filter chips.
class FilterChips<T> extends StatelessWidget {
  const FilterChips({super.key, required this.options, required this.selected, required this.onSelected, required this.labelOf});

  final List<T> options;
  final T selected;
  final ValueChanged<T> onSelected;
  final String Function(T value) labelOf;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final o = options[i];
          return ChoiceChip(
            label: Text(labelOf(o)),
            selected: o == selected,
            showCheckmark: false,
            onSelected: (_) => onSelected(o),
          );
        },
      ),
    );
  }
}
