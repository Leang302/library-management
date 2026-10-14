# Greenleaf Library

A library management system: students borrow with QR codes on their phone, and librarians approve checkouts and returns at the desk.

| Folder | What it is |
|---|---|
| [library-api/](library-api/) | Spring Boot 4 REST backend (PostgreSQL, JWT, Firebase push). Same layout as the `many to many` project. |
| [library_app/](library_app/) | Flutter mobile app for students and librarians. |
| [API.md](API.md) | The REST contract shared by the app and the backend. |
| [docs/mockup/](docs/mockup/) | The original HTML/JS clickable mockup (no backend). Open `index.html`. |

## Quick start
1. Start the backend:
   ```bash
   cd library-api
   docker compose up -d
   gradlew.bat bootRun
   ```
   Swagger UI: http://localhost:8081/swagger-ui.html
2. Run the app. See [library_app/README.md](library_app/README.md) for the one-time `flutter create .` step and the camera permissions.
   ```bash
   cd library_app
   flutter pub get
   flutter run
   ```

Demo logins: `librarian@library.com` / `library123`, and `student@library.com` (or `STU-10231`) / `student123`.

For librarians, **Scan** is the raised button in the middle of the bottom bar. It opens one scanner that recognises checkout passes, book labels, membership cards and receipts, then opens the right screen.
