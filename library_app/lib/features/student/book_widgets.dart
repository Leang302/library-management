import 'package:flutter/material.dart';

import '../../core/models/book.dart';
import '../../core/models/loan.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/book_cover.dart';

/// Grid card used on Explore.
class BookGridCard extends StatelessWidget {
  const BookGridCard({super.key, required this.book, required this.onTap});

  final Book book;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final available = book.isAvailable;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: BookCover(title: book.title, author: book.author, width: double.infinity, height: double.infinity),
          ),
          const SizedBox(height: 8),
          Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.2)),
          Text(book.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 4),
          Row(
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(color: available ? AppColors.brand : AppColors.faint, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  available ? '${book.availableCopies} of ${book.totalCopies} available' : 'All out',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: available ? AppColors.primaryText : AppColors.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Small cover + title tile for horizontal shelves.
class ShelfItem extends StatelessWidget {
  const ShelfItem({super.key, required this.book, required this.onTap});

  final Book book;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 108,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BookCover(title: book.title, author: book.author, width: 108, height: 150),
            const SizedBox(height: 6),
            Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, height: 1.2)),
            Text(
              book.isAvailable ? '${book.availableCopies} available' : 'All copies out',
              maxLines: 1,
              style: TextStyle(fontSize: 12, color: book.isAvailable ? AppColors.muted : AppColors.red),
            ),
          ],
        ),
      ),
    );
  }
}

/// Current-loan row with due status and progress bar.
class LoanCard extends StatelessWidget {
  const LoanCard({super.key, required this.loan, required this.onTap, this.loanDays = 14});

  final Loan loan;
  final VoidCallback onTap;
  final int loanDays;

  @override
  Widget build(BuildContext context) {
    final due = loan.dueAt;
    final tone = loan.isReturned ? Tone.gray : Fmt.dueTone(due);
    final days = due == null ? loanDays : Fmt.daysUntil(due);
    final pct = (1 - days / loanDays).clamp(0.04, 1.0).toDouble();
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            BookCover(title: loan.bookTitle, width: 44, height: 62),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(loan.bookTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('Borrowed ${Fmt.short(loan.borrowedAt)} · Due ${Fmt.short(due)}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  if (!loan.isReturned) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct,
                        minHeight: 4,
                        backgroundColor: AppColors.bgMuted,
                        valueColor: AlwaysStoppedAnimation<Color>(tone.fg),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(Fmt.dueLabel(due), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tone.fg)),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.faint),
          ],
        ),
      ),
    );
  }
}
