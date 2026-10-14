import 'json.dart';
import 'loan.dart';
import 'reservation.dart';

class Book {
  const Book({
    required this.id,
    required this.title,
    required this.author,
    required this.isbn,
    required this.publisher,
    required this.year,
    required this.category,
    required this.language,
    required this.description,
    required this.shelf,
    required this.pages,
    required this.archived,
    required this.totalCopies,
    required this.availableCopies,
    required this.borrowedCopies,
    required this.reservedCopies,
  });

  final int id;
  final String title;
  final String author;
  final String isbn;
  final String publisher;
  final int? year;
  final String category;
  final String language;
  final String description;
  final String shelf;
  final int? pages;
  final bool archived;
  final int totalCopies;
  final int availableCopies;
  final int borrowedCopies;
  final int reservedCopies;

  bool get isAvailable => availableCopies > 0 && !archived;

  factory Book.fromJson(Json j) => Book(
        id: asInt(j['id']),
        title: asString(j['title']),
        author: asString(j['author']),
        isbn: asString(j['isbn']),
        publisher: asString(j['publisher']),
        year: asIntOrNull(j['year']),
        category: asString(j['category']),
        language: asString(j['language']),
        description: asString(j['description']),
        shelf: asString(j['shelf']),
        pages: asIntOrNull(j['pages']),
        archived: asBool(j['archived']),
        totalCopies: asInt(j['totalCopies']),
        availableCopies: asInt(j['availableCopies']),
        borrowedCopies: asInt(j['borrowedCopies']),
        reservedCopies: asInt(j['reservedCopies']),
      );
}

class CopyStatus {
  CopyStatus._();
  static const available = 'AVAILABLE';
  static const borrowed = 'BORROWED';
  static const reserved = 'RESERVED';
  static const maintenance = 'MAINTENANCE';
  static const lost = 'LOST';
  static const all = [available, borrowed, reserved, maintenance, lost];
}

class BookCopy {
  const BookCopy({
    required this.id,
    required this.bookId,
    required this.bookTitle,
    required this.status,
    required this.condition,
    required this.note,
    this.currentLoan,
  });

  /// e.g. `BOOKCOPY-000001`
  final String id;
  final int bookId;
  final String bookTitle;

  /// CopyStatus value.
  final String status;

  /// `GOOD` | `DAMAGED`
  final String condition;
  final String note;
  final Loan? currentLoan;

  bool get isAvailable => status == CopyStatus.available;
  bool get isOnLoan => currentLoan != null || status == CopyStatus.borrowed;

  factory BookCopy.fromJson(Json j) {
    final loan = asJsonOrNull(j['currentLoan']);
    return BookCopy(
      id: asString(j['id']),
      bookId: asInt(j['bookId']),
      bookTitle: asString(j['bookTitle']),
      status: asString(j['status'], CopyStatus.available),
      condition: asString(j['condition'], 'GOOD'),
      note: asString(j['note']),
      currentLoan: loan == null ? null : Loan.fromJson(loan),
    );
  }
}

/// `GET /books/{id}`
class BookDetail {
  const BookDetail({required this.book, required this.copies, required this.queueLength, this.myReservation});

  final Book book;
  final List<BookCopy> copies;
  final int queueLength;
  final Reservation? myReservation;

  factory BookDetail.fromJson(Json j) {
    final r = asJsonOrNull(j['myReservation']);
    return BookDetail(
      book: Book.fromJson(asJson(j['book'])),
      copies: asList(j['copies'], BookCopy.fromJson),
      queueLength: asInt(j['queueLength']),
      myReservation: r == null ? null : Reservation.fromJson(r),
    );
  }
}

/// Body for `POST /books` and `PUT /books/{id}`.
class BookInput {
  const BookInput({
    required this.title,
    required this.author,
    required this.isbn,
    required this.publisher,
    required this.year,
    required this.category,
    required this.language,
    required this.description,
    required this.shelf,
    required this.pages,
    required this.copies,
  });

  final String title;
  final String author;
  final String isbn;
  final String publisher;
  final int? year;
  final String category;
  final String language;
  final String description;
  final String shelf;
  final int? pages;
  final int copies;

  Json toJson() => {
        'title': title,
        'author': author,
        'isbn': isbn,
        'publisher': publisher,
        'year': year,
        'category': category,
        'language': language,
        'description': description,
        'shelf': shelf,
        'pages': pages,
        'copies': copies,
      };

  /// Body for `PUT /books/{id}` (`BookUpdate` - same as create, without `copies`).
  Json toUpdateJson() => toJson()..remove('copies');
}
