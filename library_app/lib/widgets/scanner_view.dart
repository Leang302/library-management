import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/api/api_client.dart';
import '../core/theme.dart';

/// One-tap "simulated scan" for emulators / devices without a camera.
class ScanSample {
  const ScanSample(this.value, {this.label, this.sub});

  final String value;
  final String? label;
  final String? sub;
}

/// Inline result shown under the camera after a scan.
class ScanFeedback {
  const ScanFeedback.success(this.title, [this.message]) : ok = true;
  const ScanFeedback.error(this.title, [this.message]) : ok = false;

  final bool ok;
  final String title;
  final String? message;
}

/// Handles one scanned / typed code. Return a [ScanFeedback] to show it inline,
/// or null when the handler already gave feedback (SnackBar, navigation...).
typedef ScanHandler = Future<ScanFeedback?> Function(String code);

/// Camera (mobile_scanner) + manual entry + simulate chips.
class ScannerView extends StatefulWidget {
  const ScannerView({
    super.key,
    required this.onCode,
    this.samples = const [],
    this.hint,
    this.placeholder = 'Type or paste a code',
    this.pauseCameraWhileHandling = false,
    this.header,
    this.footer,
  });

  final ScanHandler onCode;
  final List<ScanSample> samples;

  /// Short instruction shown over the camera.
  final String? hint;
  final String placeholder;

  /// Stop the camera while [onCode] runs (use when the handler pushes a screen).
  final bool pauseCameraWhileHandling;
  final Widget? header;
  final Widget? footer;

  @override
  State<ScannerView> createState() => _ScannerViewState();
}

class _ScannerViewState extends State<ScannerView> {
  static const _repeatWindow = Duration(seconds: 4);

  final MobileScannerController _camera = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
  );
  final TextEditingController _text = TextEditingController();

  bool _busy = false;
  String? _lastCode;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);
  ScanFeedback? _feedback;
  bool _torchOn = false;

  @override
  void dispose() {
    _camera.dispose();
    _text.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value != null && value.isNotEmpty) {
        _submit(value, fromCamera: true);
        return;
      }
    }
  }

  Future<void> _safe(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {
      // Camera may be missing or already stopped - manual entry still works.
    }
  }

  Future<void> _submit(String raw, {bool fromCamera = false}) async {
    final code = raw.trim();
    if (code.isEmpty || _busy) return;
    final now = DateTime.now();
    if (fromCamera && code == _lastCode && now.difference(_lastAt) < _repeatWindow) return;
    _lastCode = code;
    _lastAt = now;

    setState(() {
      _busy = true;
      _feedback = null;
    });
    if (fromCamera) HapticFeedback.mediumImpact();
    final pause = widget.pauseCameraWhileHandling;
    if (pause) await _safe(_camera.stop);

    ScanFeedback? result;
    try {
      result = await widget.onCode(code);
    } catch (e) {
      result = ScanFeedback.error('Scan failed', errorMessage(e));
    }
    if (!mounted) return;
    if (pause) await _safe(_camera.start);
    if (!mounted) return;

    _lastAt = DateTime.now();
    setState(() {
      _busy = false;
      _feedback = result;
    });
    if (result?.ok == true || !fromCamera) _text.clear();
  }

  Future<void> _toggleTorch() async {
    await _safe(_camera.toggleTorch);
    if (mounted) setState(() => _torchOn = !_torchOn);
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.sizeOf(context).height;
    final double cameraH = (screenH * 0.42).clamp(220.0, 360.0).toDouble();
    // SingleChildScrollView (not ListView) so the camera widget is never recycled.
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.header != null) widget.header!,
          SizedBox(height: cameraH, child: _buildCamera()),
          if (_feedback != null) _FeedbackBanner(feedback: _feedback!),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _text,
                    enabled: !_busy,
                    textInputAction: TextInputAction.go,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      hintText: widget.placeholder,
                      prefixIcon: const Icon(Icons.keyboard_outlined),
                      isDense: true,
                    ),
                    onSubmitted: (v) => _submit(v),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _busy ? null : () => _submit(_text.text),
                  icon: const Icon(Icons.arrow_forward),
                  tooltip: 'Submit code',
                ),
              ],
            ),
          ),
          if (widget.samples.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 18, 16, 8),
              child: Text('No camera? Simulate a scan',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.muted)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in widget.samples)
                    ActionChip(
                      avatar: const Icon(Icons.qr_code_2, size: 18),
                      label: Text(s.sub == null ? (s.label ?? s.value) : '${s.label ?? s.value} · ${s.sub}'),
                      onPressed: _busy ? null : () => _submit(s.value),
                    ),
                ],
              ),
            ),
          ],
          if (widget.footer != null) Padding(padding: const EdgeInsets.fromLTRB(16, 20, 16, 0), child: widget.footer!),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildCamera() {
    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Container(color: Colors.black),
          MobileScanner(
            controller: _camera,
            fit: BoxFit.cover,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) => _CameraUnavailable(error: error),
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 3),
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
          if (widget.hint != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 14,
              child: IgnorePointer(
                child: Text(
                  widget.hint!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, shadows: [
                    Shadow(color: Colors.black54, blurRadius: 6),
                  ]),
                ),
              ),
            ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton(
              onPressed: _toggleTorch,
              tooltip: 'Torch',
              color: Colors.white,
              icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            ),
          ),
          if (_busy)
            Container(
              color: Colors.black45,
              alignment: Alignment.center,
              child: const CircularProgressIndicator(color: Colors.white),
            ),
        ],
      ),
    );
  }
}

class _CameraUnavailable extends StatelessWidget {
  const _CameraUnavailable({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: const Color(0xFF1C1F1D),
      padding: const EdgeInsets.all(24),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.no_photography_outlined, color: Colors.white70, size: 40),
          const SizedBox(height: 12),
          Text(
            denied ? 'Camera permission denied' : 'Camera unavailable',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 6),
          const Text(
            'Type the code below or use a simulated scan.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _FeedbackBanner extends StatelessWidget {
  const _FeedbackBanner({required this.feedback});

  final ScanFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final tone = feedback.ok ? Tone.green : Tone.red;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: tone.bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(feedback.ok ? Icons.check_circle : Icons.error, color: tone.fg),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(feedback.title, style: TextStyle(fontWeight: FontWeight.w600, color: tone.fg)),
                if (feedback.message != null)
                  Text(feedback.message!, style: const TextStyle(color: AppColors.text2, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
