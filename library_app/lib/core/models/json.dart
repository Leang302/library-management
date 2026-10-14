/// Tolerant JSON readers shared by every model's `fromJson`.
typedef Json = Map<String, dynamic>;

Json asJson(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

Json? asJsonOrNull(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : null;

int asInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? fallback;
  return fallback;
}

int? asIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

String asString(dynamic v, [String fallback = '']) => v == null ? fallback : v.toString();

String? asStringOrNull(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

bool asBool(dynamic v, [bool fallback = false]) {
  if (v is bool) return v;
  if (v is String) return v.toLowerCase() == 'true';
  if (v is num) return v != 0;
  return fallback;
}

DateTime? asDate(dynamic v) {
  if (v == null) return null;
  final d = DateTime.tryParse(v.toString());
  return d?.toLocal();
}

List<T> asList<T>(dynamic v, T Function(Json json) fromJson) {
  if (v is! List) return <T>[];
  return v.whereType<Map>().map((e) => fromJson(Map<String, dynamic>.from(e))).toList();
}

List<String> asStringList(dynamic v) {
  if (v is! List) return <String>[];
  return v.where((e) => e != null).map((e) => e.toString()).toList();
}
