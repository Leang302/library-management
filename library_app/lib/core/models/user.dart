import 'json.dart';

class Roles {
  Roles._();
  static const student = 'STUDENT';
  static const librarian = 'LIBRARIAN';
  static const all = [student, librarian];
}

class Member {
  const Member({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.studentId,
    required this.program,
    required this.year,
    required this.status,
    required this.joinedAt,
    required this.expiresAt,
    required this.activeLoans,
    required this.overdueLoans,
  });

  final int id;
  final int userId;
  final String name;
  final String email;
  final String studentId;
  final String program;
  final int? year;

  /// `ACTIVE` | `SUSPENDED`
  final String status;
  final DateTime? joinedAt;
  final DateTime? expiresAt;
  final int activeLoans;
  final int overdueLoans;

  bool get isActive => status == 'ACTIVE';
  bool get isSuspended => status == 'SUSPENDED';
  bool get isExpired => expiresAt != null && expiresAt!.isBefore(DateTime.now());
  bool get canBorrow => isActive && !isExpired;

  factory Member.fromJson(Json j) => Member(
        id: asInt(j['id']),
        userId: asInt(j['userId']),
        name: asString(j['name']),
        email: asString(j['email']),
        studentId: asString(j['studentId']),
        program: asString(j['program']),
        year: asIntOrNull(j['year']),
        status: asString(j['status'], 'ACTIVE'),
        joinedAt: asDate(j['joinedAt']),
        expiresAt: asDate(j['expiresAt']),
        activeLoans: asInt(j['activeLoans']),
        overdueLoans: asInt(j['overdueLoans']),
      );
}

class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.phone,
    required this.title,
    required this.active,
    this.member,
  });

  final int id;
  final String name;
  final String email;

  /// `STUDENT` | `LIBRARIAN`
  final String role;
  final String phone;
  final String title;
  final bool active;
  final Member? member;

  bool get isStudent => role == Roles.student;
  bool get isLibrarian => role == Roles.librarian;
  bool get isStaff => isLibrarian;

  String get firstName {
    final parts = name.trim().split(' ');
    return parts.isEmpty ? name : parts.first;
  }

  factory User.fromJson(Json j) {
    final m = asJsonOrNull(j['member']);
    return User(
      id: asInt(j['id']),
      name: asString(j['name']),
      email: asString(j['email']),
      role: asString(j['role'], Roles.student),
      phone: asString(j['phone']),
      title: asString(j['title']),
      active: asBool(j['active'], true),
      member: m == null ? null : Member.fromJson(m),
    );
  }
}

class LoginResult {
  const LoginResult(this.token, this.user);
  final String token;
  final User user;
}
