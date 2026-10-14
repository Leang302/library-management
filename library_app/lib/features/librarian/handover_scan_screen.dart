import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api.dart';
import '../../core/models/request.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/scanner_view.dart';

/// Scans each physical book handed over for a checkout request
/// (`POST /requests/{id}/handover`). Pops with the latest [Review].
class HandoverScanScreen extends StatefulWidget {
  const HandoverScanScreen({super.key, required this.review});

  final Review review;

  @override
  State<HandoverScanScreen> createState() => _HandoverScanScreenState();
}

class _HandoverScanScreenState extends State<HandoverScanScreen> {
  late final DeskService _desk = context.deskApi;
  late Review _review = widget.review;
  Timer? _autoClose;

  @override
  void dispose() {
    _autoClose?.cancel();
    super.dispose();
  }

  bool get _allScanned => _review.items.isNotEmpty && _review.scanLeft == 0;

  Future<ScanFeedback?> _onCode(String code) async {
    try {
      final res = await _desk.handover(_review.request.id, code);
      if (!mounted) return null;
      setState(() => _review = res.review);
      if (_allScanned) {
        _autoClose?.cancel();
        _autoClose = Timer(const Duration(milliseconds: 900), _done);
      }
      return ScanFeedback.success(
        res.bookTitle,
        res.swapped ? 'Recorded as ${res.copyId} (instead of ${res.from ?? 'the requested copy'})' : '${res.copyId} confirmed',
      );
    } on ApiException catch (e) {
      return ScanFeedback.error('Not accepted', e.message);
    }
  }

  void _done() {
    if (mounted) Navigator.of(context).pop(_review);
  }

  @override
  Widget build(BuildContext context) {
    final samples = [
      for (final it in _review.items) ScanSample(it.item.copyId, sub: it.item.bookTitle.length > 18 ? '${it.item.bookTitle.substring(0, 18)}…' : it.item.bookTitle),
    ];
    final scanned = _review.scanned;
    final total = _review.items.length;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Scan books to hand over'),
            Text('${_review.request.memberName} · ${Fmt.plural(total, 'book')}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w400)),
          ],
        ),
        leading: BackButton(onPressed: _done),
      ),
      body: ScannerView(
        onCode: _onCode,
        hint: 'Scan the QR label inside each book',
        placeholder: 'Copy ID, e.g. BOOKCOPY-000004',
        samples: samples,
        header: LinearProgressIndicator(
          value: total == 0 ? 0 : scanned / total,
          minHeight: 4,
          backgroundColor: AppColors.bgMuted,
          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
        ),
        footer: FilledButton.icon(
          onPressed: _done,
          icon: Icon(_allScanned ? Icons.check : Icons.done_all),
          label: Text(_allScanned ? 'All books scanned' : 'Done · $scanned of $total scanned'),
        ),
      ),
    );
  }
}
