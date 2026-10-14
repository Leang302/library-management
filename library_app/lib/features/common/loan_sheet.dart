import 'package:flutter/material.dart';

import '../../core/models/loan.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/book_cover.dart';
import '../../widgets/common.dart';
import '../../widgets/status_chip.dart';

/// Bottom sheet with a loan's details. [actions] are shown at the bottom
/// (each receives the sheet's context so it can close the sheet first).
Future<void> showLoanSheet(
  BuildContext context,
  Loan loan, {
  List<Widget Function(BuildContext sheetContext)> actions = const [],
  bool showMember = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      final returned = loan.isReturned;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Loan details', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
              const SizedBox(height: 14),
              Row(
                children: [
                  BookCover(title: loan.bookTitle, width: 48, height: 68),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(loan.bookTitle, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                        Text(loan.bookAuthor, style: const TextStyle(color: AppColors.muted)),
                        const SizedBox(height: 6),
                        StatusChip(loan.status),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              InfoCard(children: [
                if (showMember) InfoRow(label: 'Member', value: '${loan.memberName} · ${loan.studentId}', icon: Icons.person_outline),
                InfoRow(label: 'Copy ID', value: loan.copyId, icon: Icons.qr_code_2),
                InfoRow(label: 'Borrowed', value: Fmt.dateTime(loan.borrowedAt), icon: Icons.event_outlined),
                InfoRow(label: 'Due date', value: Fmt.date(loan.dueAt), icon: Icons.event_available_outlined),
                if (returned)
                  InfoRow(label: 'Returned', value: Fmt.dateTime(loan.returnedAt), icon: Icons.undo)
                else
                  InfoRow(
                    label: 'Status',
                    value: '',
                    icon: Icons.schedule,
                    valueWidget: Text(Fmt.dueLabel(loan.dueAt),
                        style: TextStyle(color: Fmt.dueTone(loan.dueAt).fg, fontWeight: FontWeight.w600)),
                  ),
                if (returned && loan.daysLate > 0)
                  InfoRow(label: 'Returned late', value: Fmt.plural(loan.daysLate, 'day'), icon: Icons.warning_amber_rounded),
                if (loan.condition != null) InfoRow(label: 'Condition', value: Fmt.enumLabel(loan.condition), icon: Icons.fact_check_outlined),
              ]),
              if (!returned) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: loan.isOverdue ? AppColors.red50 : AppColors.bgSubtle,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Return this book at the library counter before its due date. The librarian scans the label and a return receipt appears in the app.',
                    style: TextStyle(color: AppColors.text2, fontSize: 13),
                  ),
                ),
              ],
              for (final a in actions) ...[const SizedBox(height: 10), a(sheetContext)],
            ],
          ),
        ),
      );
    },
  );
}
