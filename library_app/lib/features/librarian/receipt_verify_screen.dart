import 'package:flutter/material.dart';

import '../../core/api/api.dart';
import '../../core/models/receipt.dart';
import '../../core/theme.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/empty_state.dart';
import '../common/receipt_view.dart';

/// Staff check that a scanned receipt is genuine (`GET /receipts/verify`).
class ReceiptVerifyScreen extends StatefulWidget {
  const ReceiptVerifyScreen({super.key, required this.code});

  /// Raw scanned text (`LMS-RCT:...`) or receipt number (`RT-8K2M4Q`).
  final String code;

  @override
  State<ReceiptVerifyScreen> createState() => _ReceiptVerifyScreenState();
}

class _ReceiptVerifyScreenState extends State<ReceiptVerifyScreen> with Loader<ReceiptVerifyScreen, Receipt> {
  late final DeskService _desk = context.deskApi;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<Receipt> fetch() => _desk.verifyReceipt(widget.code);

  @override
  Widget build(BuildContext context) {
    final err = error;
    final apiErr = err is ApiException ? err : null;
    final notFound = data == null && !loading && apiErr != null && (apiErr.status == 404 || apiErr.status == 422);
    return Scaffold(
      appBar: AppBar(title: const Text('Verify receipt')),
      body: notFound
          ? ListView(
              children: [
                EmptyState(
                  icon: Icons.gpp_bad_outlined,
                  title: 'Receipt not recognised',
                  message: '${apiErr?.message ?? ''}\n\nNo receipt with this code exists. It may have been edited or come from another library.',
                  action: FilledButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Scan another'),
                  ),
                ),
              ],
            )
          : buildLoaded((r) => ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const ToneBanner(
                    tone: Tone.green,
                    icon: Icons.verified_outlined,
                    title: 'Genuine receipt',
                    subtitle: 'This receipt was issued by the library and has not been altered.',
                  ),
                  const SizedBox(height: 16),
                  ReceiptView(receipt: r),
                ],
              )),
    );
  }
}
