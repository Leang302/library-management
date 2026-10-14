import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api.dart';
import '../../core/models/user.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../common/profile_screen.dart';

/// Create (incl. student fields) or edit a user. Pops with the saved [User].
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.user});

  final User? user;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final ManagementService _mgmt = context.managementApi;

  late final _name = TextEditingController(text: widget.user?.name ?? '');
  late final _email = TextEditingController(text: widget.user?.email ?? '');
  late final _phone = TextEditingController(text: widget.user?.phone ?? '');
  late final _title = TextEditingController(text: widget.user?.title ?? '');
  final _password = TextEditingController();
  late final _studentId = TextEditingController(text: widget.user?.member?.studentId ?? '');
  late final _program = TextEditingController(text: widget.user?.member?.program ?? '');
  late final _year = TextEditingController(text: widget.user?.member?.year?.toString() ?? '');

  late String _role = widget.user?.role ?? Roles.student;
  late bool _active = widget.user?.active ?? true;
  bool _obscure = true;
  bool _saving = false;
  Map<String, String> _serverErrors = const {};

  bool get _isEdit => widget.user != null;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _title, _password, _studentId, _program, _year]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _serverErrors = const {});
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'email': _email.text.trim(),
      'phone': _phone.text.trim(),
      'title': _title.text.trim(),
      'role': _role,
    };
    if (_isEdit) {
      body['active'] = _active;
      if (_password.text.isNotEmpty) body['password'] = _password.text;
    } else {
      body['password'] = _password.text;
      if (_role == Roles.student) {
        body['studentId'] = _studentId.text.trim();
        body['program'] = _program.text.trim();
        body['year'] = int.tryParse(_year.text.trim());
      }
    }

    setState(() => _saving = true);
    try {
      final saved = _isEdit ? await _mgmt.updateUser(widget.user!.id, body) : await _mgmt.createUser(body);
      if (!mounted) return;
      showSuccess(context, _isEdit ? 'Account updated' : '${saved.name} can now sign in');
      Navigator.of(context).pop(saved);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _serverErrors = e.fieldErrors;
      });
      showError(context, e);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showError(context, e);
    }
  }

  String? _required(String? v, String label) => (v == null || v.trim().isEmpty) ? '$label is required' : null;

  InputDecoration _dec(String key, String label, {String? hint, Widget? suffix}) =>
      InputDecoration(labelText: label, hintText: hint, errorText: _serverErrors[key], suffixIcon: suffix, errorMaxLines: 2);

  @override
  Widget build(BuildContext context) {
    final showStudentFields = !_isEdit && _role == Roles.student;
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit user' : 'Add user')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            const Text('Role', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final r in Roles.all)
                  ChoiceChip(
                    label: Text(ProfileScreen.roleLabel(r)),
                    selected: _role == r,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _role = r),
                  ),
              ],
            ),
            if (_isEdit && widget.user!.role != _role)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text('Their navigation and permissions change at next sign-in.',
                    style: TextStyle(color: AppColors.amber, fontSize: 12)),
              ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              textInputAction: TextInputAction.next,
              decoration: _dec('name', 'Full name *'),
              validator: (v) => _required(v, 'Name'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textInputAction: TextInputAction.next,
              decoration: _dec('email', 'Email *'),
              validator: (v) {
                final r = _required(v, 'Email');
                if (r != null) return r;
                return v!.contains('@') ? null : 'Enter a valid email';
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              obscureText: _obscure,
              textInputAction: TextInputAction.next,
              decoration: _dec(
                'password',
                _isEdit ? 'New password (leave blank to keep)' : 'Password *',
                suffix: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (v) {
                final s = v ?? '';
                if (!_isEdit && s.isEmpty) return 'Password is required';
                if (s.isNotEmpty && s.length < 6) return 'At least 6 characters';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: _dec('phone', 'Phone'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _title,
              textInputAction: TextInputAction.next,
              decoration: _dec('title', 'Job title', hint: _role == Roles.student ? 'Optional' : 'e.g. Circulation Librarian'),
            ),
            if (showStudentFields) ...[
              const SectionHeader('Student membership'),
              TextFormField(
                controller: _studentId,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.next,
                decoration: _dec('studentId', 'Student ID *', hint: 'STU-10231'),
                validator: (v) => _required(v, 'Student ID'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _program,
                textInputAction: TextInputAction.next,
                decoration: _dec('program', 'Program', hint: 'Computer Science'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _year,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _dec('year', 'Year of study', hint: '1–6'),
              ),
            ],
            if (_isEdit) ...[
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Account active'),
                subtitle: const Text('Inactive users cannot sign in'),
                value: _active,
                onChanged: (v) => setState(() => _active = v),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: BottomActions(children: [
        Expanded(
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(_isEdit ? 'Save changes' : 'Create account'),
          ),
        ),
      ]),
    );
  }
}
