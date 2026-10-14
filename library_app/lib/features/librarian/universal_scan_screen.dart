import 'package:flutter/material.dart';

import '../../core/api/api.dart';
import '../../core/models/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/scanner_view.dart';
import 'copy_info_screen.dart';
import 'member_detail_screen.dart';
import 'receipt_verify_screen.dart';
import 'request_review_screen.dart';
import 'return_screen.dart';

/// Scanner modes. [auto] lets `POST /scan/resolve` decide.
enum ScanMode { auto, checkout, returnBook, member, copy, receipt }

extension ScanModeInfo on ScanMode {
  String get label {
    switch (this) {
      case ScanMode.auto:
        return 'Auto';
      case ScanMode.checkout:
        return 'Checkout';
      case ScanMode.returnBook:
        return 'Return';
      case ScanMode.member:
        return 'Member';
      case ScanMode.copy:
        return 'Copy';
      case ScanMode.receipt:
        return 'Receipt';
    }
  }

  IconData get icon {
    switch (this) {
      case ScanMode.auto:
        return Icons.auto_awesome;
      case ScanMode.checkout:
        return Icons.qr_code_2;
      case ScanMode.returnBook:
        return Icons.undo;
      case ScanMode.member:
        return Icons.badge_outlined;
      case ScanMode.copy:
        return Icons.menu_book_outlined;
      case ScanMode.receipt:
        return Icons.receipt_long_outlined;
    }
  }

  String get hint {
    switch (this) {
      case ScanMode.auto:
        return 'Scan any checkout pass, book label, library card or receipt';
      case ScanMode.checkout:
        return 'Scan the student’s checkout pass';
      case ScanMode.returnBook:
        return 'Scan the QR label inside the returned book';
      case ScanMode.member:
        return 'Scan the student’s membership card';
      case ScanMode.copy:
        return 'Scan any physical copy label';
      case ScanMode.receipt:
        return 'Scan the QR on a student’s receipt';
    }
  }

  String get placeholder {
    switch (this) {
      case ScanMode.auto:
        return 'Any code, e.g. CR-8F3K2A or BOOKCOPY-000004';
      case ScanMode.checkout:
        return 'Request code, e.g. CR-8F3K2A';
      case ScanMode.returnBook:
      case ScanMode.copy:
        return 'Copy ID, e.g. BOOKCOPY-000004';
      case ScanMode.member:
        return 'Student ID, e.g. STU-10231';
      case ScanMode.receipt:
        return 'Receipt no., e.g. RT-8K2M4Q';
    }
  }

  /// The ScanType this mode expects (null for auto).
  String? get expectedType {
    switch (this) {
      case ScanMode.auto:
        return null;
      case ScanMode.checkout:
        return ScanType.request;
      case ScanMode.returnBook:
      case ScanMode.copy:
        return ScanType.copy;
      case ScanMode.member:
        return ScanType.member;
      case ScanMode.receipt:
        return ScanType.receipt;
    }
  }
}

class _Sample {
  const _Sample(this.sample, this.modes);
  final ScanSample sample;
  final Set<ScanMode> modes;
}

/// The librarian's universal scanner (centre button of the bottom bar).
///
/// Resolves every code with `POST /scan/resolve` and routes it:
/// REQUEST -> review, COPY -> return (if on loan) or copy info,
/// MEMBER -> member detail, RECEIPT -> receipt verification.
/// "Scan next book" on a return keeps the same receipt for the visit.
class UniversalScanScreen extends StatefulWidget {
  const UniversalScanScreen({super.key, this.initialMode = ScanMode.auto, this.receiptId});

  final ScanMode initialMode;

  /// Continue an existing return receipt (several books in one visit).
  final int? receiptId;

  @override
  State<UniversalScanScreen> createState() => _UniversalScanScreenState();
}

class _UniversalScanScreenState extends State<UniversalScanScreen> {
  late final DeskService _desk = context.deskApi;
  late ScanMode _mode = widget.initialMode;
  late int? _receiptId = widget.receiptId;
  String? _receiptNumber;
  int _returnedThisSession = 0;

  final List<_Sample> _samples = [
    const _Sample(ScanSample('BOOKCOPY-000001', sub: 'book copy'), {ScanMode.auto, ScanMode.returnBook, ScanMode.copy}),
    const _Sample(ScanSample('BOOKCOPY-000002', sub: 'book copy'), {ScanMode.auto, ScanMode.returnBook, ScanMode.copy}),
    const _Sample(ScanSample('BOOKCOPY-000004', sub: 'book copy'), {ScanMode.auto, ScanMode.returnBook, ScanMode.copy}),
    const _Sample(ScanSample('STU-10231', sub: 'student card'), {ScanMode.auto, ScanMode.member}),
  ];

  @override
  void initState() {
    super.initState();
    _loadSamples();
  }

  /// Adds pending checkout codes and on-loan copies as one-tap simulations.
  Future<void> _loadSamples() async {
    try {
      final r = await Future.wait<dynamic>([
        _desk.requests(status: RequestStatus.pending, size: 4),
        _desk.loans(status: 'ACTIVE', size: 4),
      ]);
      if (!mounted) return;
      final requests = (r[0] as PageResult<BorrowRequest>).items;
      final loans = (r[1] as PageResult<Loan>).items;
      final existing = _samples.map((s) => s.sample.value).toSet();
      setState(() {
        for (final req in requests.take(4)) {
          _samples.insert(0, _Sample(ScanSample(req.code, sub: req.memberName), {ScanMode.auto, ScanMode.checkout}));
        }
        for (final l in loans.take(4)) {
          if (existing.contains(l.copyId)) continue;
          _samples.add(_Sample(ScanSample(l.copyId, sub: 'on loan'), {ScanMode.auto, ScanMode.returnBook, ScanMode.copy}));
        }
      });
    } catch (_) {
      // Samples are a convenience for emulators; ignore failures.
    }
  }

  Future<T?> _push<T>(Widget screen) =>
      Navigator.of(context).push<T>(MaterialPageRoute<T>(builder: (_) => screen));

  Future<ScanFeedback?> _onCode(String code) async {
    final ScanResolution res;
    try {
      res = await _desk.resolve(code);
    } on ApiException catch (e) {
      return ScanFeedback.error('Scan failed', e.message);
    }
    if (!mounted) return null;

    final expected = _mode.expectedType;
    if (res.type == ScanType.unknown) {
      return ScanFeedback.error('Code not recognised',
          res.label.isNotEmpty ? res.label : 'No checkout, book copy, member or receipt matches “$code”.');
    }
    if (expected != null && res.type != expected) {
      return ScanFeedback.error(
        'Not a ${_typeName(expected)}',
        '${res.label.isNotEmpty ? res.label : 'This is a ${_typeName(res.type)}'}. Switch to Auto or ${_modeFor(res.type).label} mode.',
      );
    }

    switch (res.type) {
      case ScanType.request:
        final requestId = res.intId;
        if (requestId == null) return const ScanFeedback.error('Unknown checkout QR', 'No checkout request matches this code.');
        await _push<void>(RequestReviewScreen(requestId: requestId, fromScanner: true));
        return null;
      case ScanType.copy:
        final copyId = res.id ?? code;
        final onLoan = res.suggestedAction == 'RETURN';
        if (_mode == ScanMode.returnBook || (_mode == ScanMode.auto && onLoan)) {
          if (_mode == ScanMode.returnBook && !onLoan && res.suggestedAction != null) {
            return ScanFeedback.error('Not on loan', '${res.label.isNotEmpty ? res.label : copyId} is not currently borrowed.');
          }
          await _openReturn(copyId);
          return null;
        }
        await _push<void>(CopyInfoScreen(copyId: copyId));
        return null;
      case ScanType.member:
        final memberId = res.intId;
        if (memberId == null) return const ScanFeedback.error('Member not found', 'This QR is not a valid membership card.');
        await _push<void>(MemberDetailScreen(memberId: memberId));
        return null;
      case ScanType.receipt:
        await _push<void>(ReceiptVerifyScreen(code: code));
        return null;
      default:
        return ScanFeedback.error('Code not recognised', res.label);
    }
  }

  Future<void> _openReturn(String copyId) async {
    final outcome = await _push<ReturnOutcome>(ReturnScreen(code: copyId, receiptId: _receiptId));
    if (!mounted || outcome == null) return;
    setState(() {
      _receiptId = outcome.receiptId;
      _receiptNumber = outcome.receiptNumber;
      _returnedThisSession++;
      if (outcome.scanNext) _mode = ScanMode.returnBook;
    });
  }

  void _endSession() {
    setState(() {
      _receiptId = null;
      _receiptNumber = null;
      _returnedThisSession = 0;
    });
  }

  static String _typeName(String type) {
    switch (type) {
      case ScanType.request:
        return 'checkout pass';
      case ScanType.copy:
        return 'book label';
      case ScanType.member:
        return 'membership card';
      case ScanType.receipt:
        return 'receipt';
      default:
        return 'known code';
    }
  }

  static ScanMode _modeFor(String type) {
    switch (type) {
      case ScanType.request:
        return ScanMode.checkout;
      case ScanType.copy:
        return ScanMode.copy;
      case ScanType.member:
        return ScanMode.member;
      case ScanType.receipt:
        return ScanMode.receipt;
      default:
        return ScanMode.auto;
    }
  }

  @override
  Widget build(BuildContext context) {
    final samples = [for (final s in _samples) if (s.modes.contains(_mode)) s.sample];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                for (final m in ScanMode.values) ...[
                  ChoiceChip(
                    avatar: Icon(m.icon, size: 16, color: m == _mode ? AppColors.primaryText : AppColors.muted),
                    label: Text(m.label),
                    selected: m == _mode,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _mode = m),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
        ),
      ),
      body: ScannerView(
        onCode: _onCode,
        hint: _mode.hint,
        placeholder: _mode.placeholder,
        samples: samples,
        pauseCameraWhileHandling: true,
        header: _receiptId == null
            ? null
            : Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: ToneBanner(
                  tone: Tone.blue,
                  icon: Icons.receipt_long_outlined,
                  title: 'Return session · ${_receiptNumber ?? 'receipt #$_receiptId'}',
                  subtitle: '${_returnedThisSession == 0 ? 'Next' : '$_returnedThisSession returned · next'} book goes on the same receipt. Tap to end.',
                  onTap: _endSession,
                ),
              ),
      ),
    );
  }
}
