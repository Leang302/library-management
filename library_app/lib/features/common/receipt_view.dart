import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/models/receipt.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/status_chip.dart';

/// Paper-style receipt (header, people, lines, totals).
class ReceiptView extends StatelessWidget {
  const ReceiptView({super.key, required this.receipt});

  final Receipt receipt;

  @override
  Widget build(BuildContext context) {
    final r = receipt;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      decoration: BoxDecoration(
        color: AppColors.bgSubtle,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Greenleaf Library',
              textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          Text('${r.typeLabel} · ${r.number}',
              textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 10),
          const Divider(),
          InfoRow(label: 'Member', value: r.memberName),
          InfoRow(label: 'Staff', value: r.staffName.isEmpty ? '—' : r.staffName),
          InfoRow(label: 'Issued', value: Fmt.dateTime(r.createdAt)),
          const Divider(),
          for (final line in r.lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(line.bookTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(line.copyId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.muted)),
                        Text(
                          'Due ${Fmt.short(line.dueAt)} · returned ${Fmt.short(line.returnedAt)}',
                          style: const TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (line.condition != null) StatusChip(line.condition, dense: true),
                      const SizedBox(height: 4),
                      line.daysLate > 0
                          ? StatusChip('OVERDUE', label: '${line.daysLate}d late', dense: true)
                          : const StatusChip('RETURNED', label: 'On time', tone: Tone.green, dense: true),
                    ],
                  ),
                ],
              ),
            ),
          const Divider(),
          InfoRow(label: 'Total books', value: '${r.lines.length}'),
        ],
      ),
    );
  }
}

/// A receipt with its verification QR (students show it; staff scan it).
class ReceiptDetailScreen extends StatelessWidget {
  const ReceiptDetailScreen({super.key, required this.receipt});

  final Receipt receipt;

  @override
  Widget build(BuildContext context) {
    final qr = receipt.qrPayload;
    return Scaffold(
      appBar: AppBar(title: Text(receipt.typeLabel)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ReceiptView(receipt: receipt),
          if (qr != null && qr.isNotEmpty) ...[
            const SizedBox(height: 20),
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: QrImageView(data: qr, size: 180, backgroundColor: Colors.white),
              ),
            ),
            const SizedBox(height: 8),
            const Text('Staff can scan this code to verify the receipt is genuine.',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}
