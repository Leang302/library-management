import 'json.dart';

class TopBook {
  const TopBook({required this.bookId, required this.title, required this.count});

  final int bookId;
  final String title;
  final int count;

  factory TopBook.fromJson(Json j) => TopBook(
        bookId: asInt(j['bookId']),
        title: asString(j['title']),
        count: asInt(j['count']),
      );
}

class CategoryCount {
  const CategoryCount({required this.name, required this.count});

  final String name;
  final int count;

  factory CategoryCount.fromJson(Json j) => CategoryCount(name: asString(j['name']), count: asInt(j['count']));
}

/// `GET /dashboard/reports?days=30`
class Reports {
  const Reports({
    required this.borrowed,
    required this.returned,
    required this.overdue,
    required this.lost,
    required this.totalCopies,
    required this.totalTitles,
    required this.activeMembers,
    required this.newMembers,
    required this.topBooks,
    required this.categories,
  });

  final int borrowed;
  final int returned;
  final int overdue;
  final int lost;
  final int totalCopies;
  final int totalTitles;
  final int activeMembers;
  final int newMembers;
  final List<TopBook> topBooks;
  final List<CategoryCount> categories;

  factory Reports.fromJson(Json j) => Reports(
        borrowed: asInt(j['borrowed']),
        returned: asInt(j['returned']),
        overdue: asInt(j['overdue']),
        lost: asInt(j['lost']),
        totalCopies: asInt(j['totalCopies']),
        totalTitles: asInt(j['totalTitles']),
        activeMembers: asInt(j['activeMembers']),
        newMembers: asInt(j['newMembers']),
        topBooks: asList(j['topBooks'], TopBook.fromJson),
        categories: asList(j['categories'], CategoryCount.fromJson),
      );
}

/// `GET/PUT /settings`
class LibrarySettings {
  const LibrarySettings({
    required this.libraryName,
    required this.maxBorrow,
    required this.loanDays,
    required this.requestExpiryMin,
    required this.blockOnOverdue,
    required this.requireHandoverScan,
    required this.reservationHoldDays,
    required this.dueSoonDays,
  });

  final String libraryName;
  final int maxBorrow;
  final int loanDays;
  final int requestExpiryMin;
  final bool blockOnOverdue;
  final bool requireHandoverScan;
  final int reservationHoldDays;
  final int dueSoonDays;

  factory LibrarySettings.fromJson(Json j) => LibrarySettings(
        libraryName: asString(j['libraryName'], 'Greenleaf Library'),
        maxBorrow: asInt(j['maxBorrow'], 3),
        loanDays: asInt(j['loanDays'], 14),
        requestExpiryMin: asInt(j['requestExpiryMin'], 10),
        blockOnOverdue: asBool(j['blockOnOverdue'], true),
        requireHandoverScan: asBool(j['requireHandoverScan'], true),
        reservationHoldDays: asInt(j['reservationHoldDays'], 3),
        dueSoonDays: asInt(j['dueSoonDays'], 3),
      );

  Json toJson() => {
        'libraryName': libraryName,
        'maxBorrow': maxBorrow,
        'loanDays': loanDays,
        'requestExpiryMin': requestExpiryMin,
        'blockOnOverdue': blockOnOverdue,
        'requireHandoverScan': requireHandoverScan,
        'reservationHoldDays': reservationHoldDays,
        'dueSoonDays': dueSoonDays,
      };
}

/// `GET /audit-logs`
class AuditLog {
  const AuditLog({required this.id, required this.action, required this.detail, required this.userName, required this.createdAt});

  final int id;
  final String action;
  final String detail;
  final String userName;
  final DateTime? createdAt;

  factory AuditLog.fromJson(Json j) => AuditLog(
        id: asInt(j['id']),
        action: asString(j['action']),
        detail: asString(j['detail']),
        userName: asString(j['userName']),
        createdAt: asDate(j['createdAt']),
      );
}
