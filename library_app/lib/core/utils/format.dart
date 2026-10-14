import 'package:intl/intl.dart';

import '../theme.dart';

/// Formatting helpers for dates, due labels, counts and enum names.
class Fmt {
  Fmt._();

  static final DateFormat _date = DateFormat('d MMM yyyy');
  static final DateFormat _short = DateFormat('d MMM');
  static final DateFormat _time = DateFormat('HH:mm');
  static final DateFormat _dateTime = DateFormat('d MMM yyyy, HH:mm');
  static final DateFormat _monthYear = DateFormat('MMM yyyy');

  static String date(DateTime? d) => d == null ? '—' : _date.format(d);
  static String short(DateTime? d) => d == null ? '—' : _short.format(d);
  static String time(DateTime? d) => d == null ? '—' : _time.format(d);
  static String dateTime(DateTime? d) => d == null ? '—' : _dateTime.format(d);
  static String monthYear(DateTime? d) => d == null ? '—' : _monthYear.format(d);

  /// Whole calendar days from today until [d] (negative when in the past).
  static int daysUntil(DateTime d) {
    final now = DateTime.now();
    final a = DateTime.utc(now.year, now.month, now.day);
    final local = d.toLocal();
    final b = DateTime.utc(local.year, local.month, local.day);
    return b.difference(a).inDays;
  }

  /// "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue".
  static String dueLabel(DateTime? due) {
    if (due == null) return 'No due date';
    final d = daysUntil(due);
    if (d < 0) return '${plural(-d, 'day')} overdue';
    if (d == 0) return 'Due today';
    if (d == 1) return 'Due tomorrow';
    return 'Due in $d days';
  }

  /// Tone for a due date: red when overdue, amber when within [soonDays], else green.
  static Tone dueTone(DateTime? due, {int soonDays = 3}) {
    if (due == null) return Tone.gray;
    final d = daysUntil(due);
    if (d < 0) return Tone.red;
    if (d <= soonDays) return Tone.amber;
    return Tone.green;
  }

  static String relative(DateTime? t) {
    if (t == null) return '—';
    final diff = DateTime.now().difference(t);
    if (diff.isNegative || diff.inSeconds < 45) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} h ago';
    if (diff.inDays == 1) return 'yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return date(t);
  }

  static String plural(int n, String word, [String? pluralWord]) =>
      '$n ${n == 1 ? word : (pluralWord ?? '${word}s')}';

  static String greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /// mm:ss countdown.
  static String countdown(Duration d) {
    if (d.isNegative) return '00:00';
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  /// `PENDING_APPROVAL` -> `Pending approval`.
  static String enumLabel(String? v) {
    if (v == null || v.isEmpty) return '—';
    final s = v.replaceAll('_', ' ').toLowerCase();
    return s[0].toUpperCase() + s.substring(1);
  }

  static String initials(String? name) {
    final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

/// Status colour for any enum value from the API.
Tone toneForStatus(String? status) {
  switch (status) {
    case 'AVAILABLE':
    case 'APPROVED':
    case 'READY':
    case 'GOOD':
    case 'FULFILLED':
    case 'STUDENT':
      return Tone.green;
    case 'ACTIVE':
    case 'BORROWED':
    case 'WAITING':
    case 'LIBRARIAN':
      return Tone.blue;
    case 'PENDING_APPROVAL':
    case 'RESERVED':
    case 'MAINTENANCE':
      return Tone.amber;
    case 'OVERDUE':
    case 'REJECTED':
    case 'LOST':
    case 'DAMAGED':
    case 'SUSPENDED':
      return Tone.red;
    default:
      return Tone.gray;
  }
}
