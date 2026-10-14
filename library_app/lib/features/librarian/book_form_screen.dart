import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api/api.dart';
import '../../core/models/book.dart';
import '../../core/state/refresh_bus.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';

/// Add a new title (with N copies) or edit an existing one. Pops with the saved [Book].
class BookFormScreen extends StatefulWidget {
  const BookFormScreen({super.key, this.book});

  final Book? book;

  @override
  State<BookFormScreen> createState() => _BookFormScreenState();
}

class _BookFormScreenState extends State<BookFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final BooksService _books = context.booksApi;

  late final _title = TextEditingController(text: widget.book?.title ?? '');
  late final _author = TextEditingController(text: widget.book?.author ?? '');
  late final _isbn = TextEditingController(text: widget.book?.isbn ?? '');
  late final _publisher = TextEditingController(text: widget.book?.publisher ?? '');
  late final _year = TextEditingController(text: widget.book?.year?.toString() ?? '');
  late final _category = TextEditingController(text: widget.book?.category ?? '');
  late final _language = TextEditingController(text: widget.book?.language ?? 'English');
  late final _description = TextEditingController(text: widget.book?.description ?? '');
  late final _shelf = TextEditingController(text: widget.book?.shelf ?? '');
  late final _pages = TextEditingController(text: widget.book?.pages?.toString() ?? '');
  final _copies = TextEditingController(text: '1');

  List<String> _categories = const [];
  Map<String, String> _serverErrors = const {};
  bool _saving = false;

  bool get _isEdit => widget.book != null;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void dispose() {
    for (final c in [_title, _author, _isbn, _publisher, _year, _category, _language, _description, _shelf, _pages, _copies]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final c = await _books.categories();
      if (mounted) setState(() => _categories = c);
    } catch (_) {
      // Suggestions only.
    }
  }

  int? _intOrNull(TextEditingController c) => c.text.trim().isEmpty ? null : int.tryParse(c.text.trim());

  Future<void> _save() async {
    setState(() => _serverErrors = const {});
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final input = BookInput(
      title: _title.text.trim(),
      author: _author.text.trim(),
      isbn: _isbn.text.trim(),
      publisher: _publisher.text.trim(),
      year: _intOrNull(_year),
      category: _category.text.trim(),
      language: _language.text.trim(),
      description: _description.text.trim(),
      shelf: _shelf.text.trim(),
      pages: _intOrNull(_pages),
      copies: _intOrNull(_copies) ?? 0,
    );
    setState(() => _saving = true);
    final bus = context.read<RefreshBus>();
    try {
      final saved = _isEdit ? await _books.update(widget.book!.id, input) : await _books.create(input);
      bus.bump();
      if (!mounted) return;
      showSuccess(context, _isEdit ? 'Book updated' : '“${saved.title}” added');
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

  String? _optionalInt(String? v, {int min = 0, int max = 100000}) {
    if (v == null || v.trim().isEmpty) return null;
    final n = int.tryParse(v.trim());
    if (n == null || n < min || n > max) return 'Enter a number between $min and $max';
    return null;
  }

  Widget _field(
    String key,
    TextEditingController c,
    String label, {
    String? Function(String?)? validator,
    TextInputType? keyboard,
    bool digits = false,
    int maxLines = 1,
    String? hint,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        keyboardType: keyboard,
        maxLines: maxLines,
        inputFormatters: digits ? [FilteringTextInputFormatter.digitsOnly] : null,
        textInputAction: maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
        decoration: InputDecoration(labelText: label, hintText: hint, errorText: _serverErrors[key], errorMaxLines: 2),
        validator: validator,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit book' : 'Add book')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            _field('title', _title, 'Title *', validator: (v) => _required(v, 'Title')),
            _field('author', _author, 'Author *', validator: (v) => _required(v, 'Author')),
            _field('isbn', _isbn, 'ISBN', keyboard: TextInputType.number, hint: '9780735211292'),
            _field('category', _category, 'Category', hint: 'e.g. Self-Help'),
            if (_categories.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final c in _categories)
                      ActionChip(
                        label: Text(c, style: const TextStyle(fontSize: 12)),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: _category.text == c ? AppColors.primary50 : null,
                        onPressed: () => setState(() => _category.text = c),
                      ),
                  ],
                ),
              ),
            Row(
              children: [
                Expanded(child: _field('shelf', _shelf, 'Shelf', hint: 'A-01')),
                const SizedBox(width: 10),
                Expanded(child: _field('language', _language, 'Language')),
              ],
            ),
            _field('publisher', _publisher, 'Publisher'),
            Row(
              children: [
                Expanded(
                  child: _field('year', _year, 'Year',
                      keyboard: TextInputType.number, digits: true, validator: (v) => _optionalInt(v, min: 1000, max: 2100)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _field('pages', _pages, 'Pages',
                      keyboard: TextInputType.number, digits: true, validator: (v) => _optionalInt(v, min: 1, max: 20000)),
                ),
              ],
            ),
            _field('description', _description, 'Description', maxLines: 4),
            if (!_isEdit)
              _field('copies', _copies, 'Number of copies',
                  keyboard: TextInputType.number, digits: true, validator: (v) => _optionalInt(v, min: 0, max: 50)),
            if (!_isEdit)
              const Text('Each copy gets its own QR label (BOOKCOPY-xxxxxx).',
                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
          ],
        ),
      ),
      bottomNavigationBar: BottomActions(children: [
        Expanded(
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(_isEdit ? 'Save changes' : 'Add book'),
          ),
        ),
      ]),
    );
  }
}
