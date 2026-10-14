import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api.dart';
import '../../core/models/management.dart';
import '../../core/theme.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';

/// Borrowing policies (`GET/PUT /settings`).
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with Loader<SettingsScreen, LibrarySettings> {
  final _formKey = GlobalKey<FormState>();
  late final ManagementService _mgmt = context.managementApi;

  final _libraryName = TextEditingController();
  final _maxBorrow = TextEditingController();
  final _loanDays = TextEditingController();
  final _requestExpiry = TextEditingController();
  final _holdDays = TextEditingController();
  final _dueSoon = TextEditingController();
  bool _blockOnOverdue = true;
  bool _requireHandoverScan = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final c in [_libraryName, _maxBorrow, _loanDays, _requestExpiry, _holdDays, _dueSoon]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Future<LibrarySettings> fetch() async {
    final s = await _mgmt.settings();
    _fill(s);
    return s;
  }

  void _fill(LibrarySettings s) {
    _libraryName.text = s.libraryName;
    _maxBorrow.text = '${s.maxBorrow}';
    _loanDays.text = '${s.loanDays}';
    _requestExpiry.text = '${s.requestExpiryMin}';
    _holdDays.text = '${s.reservationHoldDays}';
    _dueSoon.text = '${s.dueSoonDays}';
    _blockOnOverdue = s.blockOnOverdue;
    _requireHandoverScan = s.requireHandoverScan;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final s = LibrarySettings(
      libraryName: _libraryName.text.trim(),
      maxBorrow: int.parse(_maxBorrow.text.trim()),
      loanDays: int.parse(_loanDays.text.trim()),
      requestExpiryMin: int.parse(_requestExpiry.text.trim()),
      blockOnOverdue: _blockOnOverdue,
      requireHandoverScan: _requireHandoverScan,
      reservationHoldDays: int.parse(_holdDays.text.trim()),
      dueSoonDays: int.parse(_dueSoon.text.trim()),
    );
    setState(() => _saving = true);
    try {
      final saved = await _mgmt.saveSettings(s);
      if (!mounted) return;
      setState(() {
        _fill(saved);
        data = saved;
        _saving = false;
      });
      showSuccess(context, 'Policies saved');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showError(context, e);
    }
  }

  Widget _number(TextEditingController c, String label, String helper, {int min = 0, int max = 365}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label, helperText: helper),
        validator: (v) {
          final n = int.tryParse((v ?? '').trim());
          if (n == null || n < min || n > max) return 'Enter a number from $min to $max';
          return null;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Policies & settings')),
      body: buildLoaded((_) => Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                TextFormField(
                  controller: _libraryName,
                  decoration: const InputDecoration(labelText: 'Library name'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Library name is required' : null,
                ),
                const SectionHeader('Borrowing'),
                _number(_maxBorrow, 'Borrowing limit', 'Books a student can have at once', min: 1, max: 50),
                _number(_loanDays, 'Loan period (days)', 'Due date = approval date + this many days', min: 1, max: 365),
                _number(_dueSoon, '“Due soon” warning (days)', 'Highlight loans due within this many days', min: 0, max: 30),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Block borrowing while overdue'),
                  subtitle: const Text('Students with an overdue book cannot check out more'),
                  value: _blockOnOverdue,
                  onChanged: (v) => setState(() => _blockOnOverdue = v),
                ),
                const SectionHeader('Checkout desk'),
                _number(_requestExpiry, 'Checkout QR validity (minutes)', 'A pending checkout expires after this long', min: 1, max: 120),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Require handover scan'),
                  subtitle: const Text('Librarian must scan every book before approving'),
                  value: _requireHandoverScan,
                  onChanged: (v) => setState(() => _requireHandoverScan = v),
                ),
                const SectionHeader('Reservations'),
                _number(_holdDays, 'Hold period (days)', 'How long a returned copy is held for the next in queue', min: 1, max: 30),
                const SizedBox(height: 8),
                const Text('Changes apply to new checkouts. Existing loans keep their due dates.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
              ],
            ),
          )),
      bottomNavigationBar: data == null
          ? null
          : BottomActions(children: [
              Expanded(
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Save policies'),
                ),
              ),
            ]),
    );
  }
}
