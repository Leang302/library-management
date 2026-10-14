import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/page.dart';

/// Error raised for every failed API call. [message] is safe to show to users.
class ApiException implements Exception {
  const ApiException(this.status, this.message, [this.fieldErrors = const {}]);

  /// HTTP status, or 0 when the server could not be reached.
  final int status;
  final String message;

  /// Per-field validation messages (only for HTTP 400, from `validationErrors`).
  final Map<String, String> fieldErrors;

  bool get isNetwork => status == 0;
  bool get isNotFound => status == 404;

  @override
  String toString() => message;
}

/// Readable message for any error thrown while talking to the API.
String errorMessage(Object error) {
  if (error is ApiException) return error.message;
  if (error is FormatException) return 'The server sent an unexpected response.';
  return 'Something went wrong. Please try again.';
}

/// Thin JSON-over-HTTP wrapper: base URL, bearer token, JSON decode,
/// unwrapping of the success envelope and conversion of the API's error body
/// into [ApiException].
///
/// Every success response is `{ message, status, code, localDateTime, payload }`.
/// [get] / [post] / [put] / [patch] / [delete] return just `payload` (null when
/// the envelope has none), so services receive the data itself. Paged
/// endpoints use [getPage], which also reads the pagination fields.
class ApiClient {
  ApiClient({required String baseUrl, http.Client? client})
      : _baseUrl = normalizeBaseUrl(baseUrl),
        _http = client ?? http.Client();

  static const Duration timeout = Duration(seconds: 20);

  /// Largest `size` the API accepts for paged endpoints.
  static const int maxPageSize = 100;

  final http.Client _http;
  String _baseUrl;

  /// JWT from `POST /auth/login`.
  String? token;

  /// Called when an authenticated request returns 401 (expired / revoked token).
  void Function()? onUnauthorized;

  String get baseUrl => _baseUrl;
  set baseUrl(String value) => _baseUrl = normalizeBaseUrl(value);

  static String normalizeBaseUrl(String value) {
    var s = value.trim();
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    return s;
  }

  Future<dynamic> get(String path, {Map<String, Object?>? query}) async =>
      unwrapPayload(await _send('GET', path, query: query));

  /// [authenticated] = false omits the bearer token (used by `POST /auth/logout`).
  Future<dynamic> post(String path, {Object? body, Map<String, Object?>? query, bool authenticated = true}) async =>
      unwrapPayload(await _send('POST', path, body: body, query: query, authenticated: authenticated));

  Future<dynamic> put(String path, {Object? body}) async => unwrapPayload(await _send('PUT', path, body: body));

  Future<dynamic> patch(String path, {Object? body}) async => unwrapPayload(await _send('PATCH', path, body: body));

  Future<dynamic> delete(String path) async => unwrapPayload(await _send('DELETE', path));

  /// GET a paged endpoint. [page] is 1-based; [size] is clamped to 1..[maxPageSize].
  Future<PageResult<T>> getPage<T>(
    String path,
    T Function(Map<String, dynamic> json) fromJson, {
    int page = 1,
    int size = 20,
    Map<String, Object?>? query,
  }) async {
    final q = <String, Object?>{
      ...?query,
      'page': page < 1 ? 1 : page,
      'size': size.clamp(1, maxPageSize),
    };
    final envelope = await _send('GET', path, query: q);
    if (envelope is List) {
      // Tolerate a bare list: treat it as one complete page.
      return PageResult<T>.fromEnvelope(<String, dynamic>{'payload': envelope}, fromJson);
    }
    return PageResult<T>.fromEnvelope(envelope, fromJson);
  }

  /// Returns `payload` from a success envelope; anything that does not look
  /// like an envelope is returned unchanged.
  static dynamic unwrapPayload(dynamic decoded) {
    if (decoded is Map) {
      if (decoded.containsKey('payload')) return decoded['payload'];
      // Envelope without payload (deletes, mark-read, nothing pending...).
      if (decoded.containsKey('code') && decoded.containsKey('status') && decoded.containsKey('message')) return null;
    }
    return decoded;
  }

  Uri _uri(String path, Map<String, Object?>? query) {
    final uri = Uri.parse('$_baseUrl$path');
    if (query == null) return uri;
    final params = <String, String>{};
    query.forEach((key, value) {
      if (value == null) return;
      final s = value.toString();
      if (s.isNotEmpty) params[key] = s;
    });
    return params.isEmpty ? uri : uri.replace(queryParameters: params);
  }

  /// Sends the request and returns the decoded body (the whole envelope).
  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    bool authenticated = true,
  }) async {
    final Uri uri;
    try {
      uri = _uri(path, query);
    } on FormatException {
      throw ApiException(0, 'The server URL "$_baseUrl" is not valid. Check it in settings.');
    }

    final request = http.Request(method, uri);
    request.headers['Accept'] = 'application/json';
    final t = authenticated ? token : null;
    if (t != null && t.isNotEmpty) request.headers['Authorization'] = 'Bearer $t';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json; charset=utf-8';
      request.body = jsonEncode(body);
    }

    final http.Response response;
    try {
      final streamed = await _http.send(request).timeout(timeout);
      response = await http.Response.fromStream(streamed).timeout(timeout);
    } on TimeoutException {
      throw const ApiException(0, 'The server took too long to respond. Please try again.');
    } catch (_) {
      throw ApiException(0, 'Cannot reach the server at $_baseUrl. Check your connection and the server URL.');
    }

    final text = utf8.decode(response.bodyBytes, allowMalformed: true);
    final status = response.statusCode;

    if (status >= 200 && status < 300) {
      if (status == 204 || text.trim().isEmpty) return null;
      try {
        return jsonDecode(text);
      } on FormatException {
        throw ApiException(status, 'The server sent an unexpected response.');
      }
    }

    final error = _parseError(status, text, path);
    if (status == 401 && t != null && path != '/auth/login' && path != '/auth/logout') {
      onUnauthorized?.call();
    }
    throw error;
  }

  ApiException _parseError(int status, String text, String path) {
    String? message;
    final fields = <String, String>{};
    try {
      final decoded = jsonDecode(text);
      if (decoded is Map) {
        final m = decoded['message'];
        if (m != null && m.toString().trim().isNotEmpty) message = m.toString();
        // `validationErrors` (current API); `fieldErrors` accepted from older servers.
        final fe = decoded['validationErrors'] ?? decoded['fieldErrors'];
        if (fe is Map) {
          fe.forEach((k, v) {
            if (k != null && v != null) fields[k.toString()] = v.toString();
          });
        }
        if (message == null) {
          final e = decoded['error'];
          if (e != null && e.toString().trim().isNotEmpty) message = e.toString();
        }
      }
    } catch (_) {
      // Not JSON (e.g. a proxy error page) - fall through to a generic message.
    }
    // Validation failures carry the generic "Invalid Request"; the field
    // messages (shown under the inputs) are more useful.
    if (fields.isNotEmpty && (message == null || message.toLowerCase() == 'invalid request')) {
      message = fields.length == 1 ? fields.values.first : null;
    }
    message ??= _defaultMessage(status, path);
    return ApiException(status, message, fields);
  }

  static String _defaultMessage(int status, String path) {
    switch (status) {
      case 400:
        return 'Please check the highlighted fields.';
      case 401:
        return path == '/auth/login' ? 'Wrong email/student ID or password.' : 'Your session has expired. Please sign in again.';
      case 403:
        return 'You don\'t have permission to do that.';
      case 404:
        return 'Not found.';
      case 409:
        return 'This conflicts with the current state. Refresh and try again.';
      case 422:
        return 'This action is not allowed right now.';
      default:
        return 'Server error ($status). Please try again.';
    }
  }
}
