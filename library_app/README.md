# Greenleaf Library — Flutter app

Mobile app for the Greenleaf Library management system. One app, two roles:

| Role | Bottom navigation (centre = raised **Scan** button) |
|---|---|
| Student | Home · Explore · **[Scan]** · My Books · Profile |
| Librarian | Dashboard · Requests · **[Scan]** · Books · Profile |

It talks to the Spring Boot backend (`library-api/`) through the REST contract in [`../API.md`](../API.md).

## 1. Generate the platform folders (one time)

This folder only has `lib/`, `test/` and `pubspec.yaml`. The `android/`, `ios/` and other platform folders are not committed. Create them with Flutter. This doesn't overwrite `lib/`, `pubspec.yaml`, `README.md` or `analysis_options.yaml`:

```bash
cd library_app
flutter create . --project-name library_app --org com.example
flutter pub get
```

Requires Flutter 3.19 or newer (Dart ≥ 3.3).

## 2. Android setup (camera + HTTP)

Edit `android/app/src/main/AndroidManifest.xml`:

1. Add the camera permission inside `<manifest>`, above `<application>`:

   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```

2. Allow plain-HTTP traffic to the local backend. Add `android:usesCleartextTraffic="true"` to the `<application>` tag:

   ```xml
   <application
       android:label="library_app"
       android:usesCleartextTraffic="true"
       ...>
   ```

`mobile_scanner` 5.x needs `minSdkVersion 21` or higher. Recent Flutter templates already use 21 or more. If yours doesn't, set `minSdk = 21` in `android/app/build.gradle`.

## 3. iOS setup (camera)

Add a camera usage description to `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>The camera is used to scan book, checkout, membership and receipt QR codes.</string>
```

To reach a backend on plain `http://` from a real iOS device, also add an App Transport Security exception (`NSAppTransportSecurity` → `NSAllowsArbitraryLoads` = `true`) for development. The simulator with `http://localhost` works without it.

`mobile_scanner` needs iOS 12 or higher. If `pod install` complains, set `platform :ios, '12.0'` in `ios/Podfile`.

## 4. Run

Start the backend first (it listens on port 8081 and seeds the demo data), then:

```bash
flutter run
```

### Server URL
- Android emulator: `http://10.0.2.2:8081/api/v1` (default on Android)
- iOS simulator, desktop and web: `http://localhost:8081/api/v1` (default elsewhere)
- Physical phone: use your computer's LAN IP, e.g. `http://192.168.1.20:8081/api/v1`

You can change the URL from the **Server** link on the sign-in screen or from **Profile → Server URL**. It is stored with `shared_preferences`. A URL saved by an older version that ends in `/api` is upgraded to `/api/v1` automatically.

### Demo accounts
Tap a chip on the sign-in screen to fill these in:

| Role | Login | Password |
|---|---|---|
| Student | student@library.com or `STU-10231` | student123 |
| Librarian | librarian@library.com | library123 |

### No camera? (emulators)
Every scanner has a manual code field and **"Simulate a scan"** chips, for example `BOOKCOPY-000001`, `STU-10231` and the codes of pending checkouts. If the camera can't start, the preview shows "Camera unavailable" and the rest of the scanner still works.

## 5. Push notifications (optional)

Every in-app notification is also pushed with Firebase Cloud Messaging (FCM) to the devices the recipient is **currently signed in on**. **Without the setup below the app still works fully.** At startup it logs `Push notifications disabled: Firebase is not configured` and skips push. The in-app Notifications list still works.

### How targeting works
- **Sign in:** the app gets this phone's FCM token and sends it with the login request (`deviceToken`, `platform`). The backend binds the token to that user, and only to that user. If someone else used this phone before, their binding is replaced.
- **Token rotation:** when FCM issues a new token while you are signed in, the app re-registers it with `POST /notifications/devices`.
- **Sign out:** the app calls `POST /auth/logout` with the token, then deletes the token on the device (`FirebaseMessaging.deleteToken()`), so nothing sent to it is delivered any more. It also clears every notification already shown. The next person who signs in gets a fresh token, so they only receive their own pushes. Sign-out works offline. In that case the token is still deleted locally, and the server-side unbind is retried on the next app start.
- **While signed out**, foreground pushes are ignored and taps on a push do nothing.
- **Tapping a push** opens what it points at (`linkTo` / `linkId`): `mybooks` → My Books, `receipt` → that receipt, `requestReview` → the request review (librarian), `bookDetail` → the book. Anything else opens the Notifications screen. Tapping an item in the Notifications screen does the same.

### Firebase project
1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. The simplest path is to run `dart pub global activate flutterfire_cli` and then `flutterfire configure` in `library_app/`. Select Android and iOS. It registers the apps, downloads the config files and adds the Gradle plugin. The app calls `Firebase.initializeApp()` **without** options and reads the native config files. You don't need the generated `firebase_options.dart`, and you can delete it.
   If you prefer to do it by hand, follow the two sections below.

### Android
1. In Firebase, add an Android app with package name **`com.example.library_app`** (the name `flutter create --org com.example` generates). Download **`google-services.json`** into `android/app/`.
2. Add the Google services Gradle plugin, as described in the [FlutterFire Android setup](https://firebase.google.com/docs/flutter/setup?platform=android):
   - `android/settings.gradle` → in `plugins { }`: `id "com.google.gms.google-services" version "4.4.2" apply false`
   - `android/app/build.gradle` → in `plugins { }`: `id "com.google.gms.google-services"`
3. `flutter_local_notifications` needs core library desugaring. In `android/app/build.gradle`:
   ```gradle
   android {
       compileOptions {
           coreLibraryDesugaringEnabled true
           // keep the existing sourceCompatibility / targetCompatibility lines
       }
   }
   dependencies {
       coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'
   }
   ```
   Set `minSdk` to at least 21 (23 is recommended).
4. In `android/app/src/main/AndroidManifest.xml`, add the Android 13+ notification permission next to the camera permission:
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```
   Optionally, inside `<application>`, make `library_default` the default channel for pushes that arrive before the app has created it:
   ```xml
   <meta-data
       android:name="com.google.firebase.messaging.default_notification_channel_id"
       android:value="library_default" />
   ```
   The app creates the `library_default` channel ("Library", high importance) at startup and asks for notification permission at sign-in.

### iOS
1. In Firebase, add an iOS app with the bundle ID from Xcode (by default `com.example.libraryApp`). Download **`GoogleService-Info.plist`** and add it to `ios/Runner` **through Xcode** (Runner target, "Copy items if needed").
2. In Xcode → Runner → *Signing & Capabilities*, add **Push Notifications** and **Background Modes**, and tick *Remote notifications*.
3. In the Apple Developer portal, create an **APNs auth key** (.p8). Upload it in Firebase console → Project settings → Cloud Messaging → Apple app configuration.
4. Push only works on a real device, or on a simulator running iOS 16+ on Apple silicon.

### Backend
Create a service-account key in Firebase console → Project settings → Service accounts → *Generate new private key*. Start the API with:
```bash
FIREBASE_CREDENTIALS=/path/to/service-account.json
```
If this is not set, the backend still stores in-app notifications but sends no pushes.

## 6. Main flows

**Student**
1. Scan a book's QR label (centre button). It goes straight into the borrow cart. Scanning is continuous, so you can scan several books in a row.
2. Open the **Cart**, check the eligibility list, then tap **Generate Checkout QR**.
3. Show the **Checkout pass** at the counter. The QR counts down, renews itself before it expires, and polls the server every 3 s. It flips to *Approved* or *Rejected* when the librarian acts.
4. **My Books** has four tabs: Borrowed, Reservations, History and Receipts. A receipt has its own QR so staff can verify it.

**Librarian**: the centre **Scan** opens one universal scanner. It calls `POST /scan/resolve` and routes the code automatically:
- checkout pass → request review. From there, scan the books being handed over, then Approve or Reject with a reason.
- book label → the return flow if the book is on loan (condition, note, confirm, receipt), otherwise copy info. **Scan next book** keeps the same receipt, so one visit gets one receipt.
- membership card → member detail (suspend, activate, renew).
- receipt → genuine-receipt check.

The mode chips (Auto, Checkout, Return, Member, Copy, Receipt) force a mode.

**Library management** (Profile › Manage library, any librarian): users, members, requests, loans, policies and settings, reports (7D/30D/90D/1Y) and the audit log.

## Project structure

```
lib/
  main.dart, app.dart          entry point, providers, theme, auth gate
  core/
    api/api_client.dart        http wrapper: base URL, bearer token, unwraps the `payload` envelope,
                               getPage() for paged lists, ApiException(status, message, fieldErrors)
    api/api.dart               BuildContext shortcuts (context.deskApi, ...)
    api/services/              auth, books, student (/me), desk (librarian), management, notifications
    models/                    fromJson for every object in API.md, PageResult<T>
    push/push_service.dart     Firebase Cloud Messaging + local notifications (optional)
    state/                     AuthProvider, CartProvider, ShellController, RefreshBus
    theme.dart                 Greenleaf palette + Material 3 theme
    utils/format.dart          dates, "Due in 3 days", status colours
  widgets/                     role_shell (centre Scan FAB), scanner_view, status_chip,
                               book_cover, check_list, empty_state, async_view, ...
  features/
    auth/      login
    student/   home, explore, book detail, cart, checkout QR, my books, member card, scan
    librarian/ dashboard, requests, review + handover scan, universal scanner, return,
               loans, members, copy info, receipt verify, books inventory/manage/form
    management/ manage hub, reports, users (+form), settings, audit log
    common/    profile, notifications (+ notification_links: push/notification tap routing),
               receipt view, loan sheet, server URL dialog
```

## Checks

```bash
flutter analyze
flutter test
```
