import 'package:flutter/material.dart';

import 'app.dart';
import 'core/api/api_client.dart';
import 'core/push/push_service.dart';
import 'core/state/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Firebase / FCM. Fails quietly (push disabled) when Firebase isn't configured.
  await PushService.instance.init();
  final api = ApiClient(baseUrl: AuthProvider.defaultServerUrl());
  final auth = AuthProvider(api, push: PushService.instance);
  // Restores the saved server URL and session; the app shows a splash meanwhile.
  auth.init();
  runApp(LibraryApp(api: api, auth: auth));
}
