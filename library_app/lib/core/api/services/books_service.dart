import '../../models/models.dart';
import '../api_client.dart';

/// Catalogue (any signed-in user) and book management (staff).
class BooksService {
  const BooksService(this.api);
  final ApiClient api;

  /// `GET /books` (paged). [sort] = `id|title|author|year|category|createdAt`.
  Future<PageResult<Book>> list({
    String? q,
    String? category,
    bool availableOnly = false,
    bool includeArchived = false,
    String sort = 'title',
    String direction = 'ASC',
    int page = 1,
    int size = 20,
  }) =>
      api.getPage('/books', Book.fromJson, page: page, size: size, query: {
        'q': q,
        'category': category,
        'availableOnly': availableOnly ? 'true' : null,
        'includeArchived': includeArchived ? 'true' : null,
        'sort': sort,
        'direction': direction,
      });

  Future<BookDetail> detail(int id) async => BookDetail.fromJson(asJson(await api.get('/books/$id')));

  Future<List<String>> categories() async => asStringList(await api.get('/books/categories'));

  Future<Book> create(BookInput input) async => Book.fromJson(asJson(await api.post('/books', body: input.toJson())));

  /// `PUT /books/{id}` - the body has no `copies` (use [addCopies]).
  Future<Book> update(int id, BookInput input) async =>
      Book.fromJson(asJson(await api.put('/books/$id', body: input.toUpdateJson())));

  Future<List<BookCopy>> addCopies(int id, int count) async =>
      asList(await api.post('/books/$id/copies', body: {'count': count}), BookCopy.fromJson);

  Future<Book> setArchived(int id, bool archived) async =>
      Book.fromJson(asJson(await api.patch('/books/$id/archive', body: {'archived': archived})));

  Future<void> delete(int id) async {
    await api.delete('/books/$id');
  }
}
