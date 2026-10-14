import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import 'api_client.dart';
import 'services/management_service.dart';
import 'services/auth_service.dart';
import 'services/books_service.dart';
import 'services/desk_service.dart';
import 'services/notification_service.dart';
import 'services/student_service.dart';

export '../models/page.dart';
export 'api_client.dart';
export 'services/management_service.dart';
export 'services/auth_service.dart';
export 'services/books_service.dart';
export 'services/desk_service.dart';
export 'services/notification_service.dart';
export 'services/student_service.dart';

/// Shortcuts that build a service around the [ApiClient] provided at the app root.
/// They use `read`, so call them in `initState` / callbacks, not to listen in `build`.
extension ApiContext on BuildContext {
  ApiClient get api => read<ApiClient>();
  AuthService get authApi => AuthService(api);
  BooksService get booksApi => BooksService(api);
  StudentService get studentApi => StudentService(api);
  DeskService get deskApi => DeskService(api);
  ManagementService get managementApi => ManagementService(api);
  NotificationService get notificationsApi => NotificationService(api);
}
