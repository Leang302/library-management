import 'json.dart';

/// One page of a paged list endpoint (`PaginationResponse` in the API).
///
/// [page] is 1-based, as sent by the server.
class PageResult<T> {
  const PageResult({
    required this.items,
    required this.page,
    required this.size,
    required this.totalPages,
    required this.totalElements,
    required this.hasNext,
  });

  final List<T> items;
  final int page;
  final int size;
  final int totalPages;
  final int totalElements;
  final bool hasNext;

  /// Builds a page from the full response envelope
  /// (`{ payload: [...], page, size, totalElements, totalPages, hasNext, ... }`).
  factory PageResult.fromEnvelope(dynamic envelope, T Function(Json json) fromJson) {
    final env = asJson(envelope);
    final items = asList(env['payload'], fromJson);
    final page = asInt(env['page'], 1);
    final totalPages = asInt(env['totalPages'], items.isEmpty ? 0 : 1);
    final hasNextRaw = env['hasNext'];
    final hasNext = hasNextRaw == null
        ? (env['last'] != null ? !asBool(env['last']) : page < totalPages)
        : asBool(hasNextRaw);
    return PageResult<T>(
      items: items,
      page: page,
      size: asInt(env['size'], items.length),
      totalPages: totalPages,
      totalElements: asInt(env['totalElements'], items.length),
      hasNext: hasNext,
    );
  }
}
