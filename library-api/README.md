# Greenleaf Library API (Spring Boot)

REST backend for the Greenleaf Library mobile app (`../library_app`). It covers the catalogue, QR checkout with librarian approval, returns with receipts, reservations, in-app and **push notifications**, dashboards and library management. PostgreSQL stores the data.

The full request/response contract is in [../API.md](../API.md).

## Stack
- Spring Boot 4.0, Java 21, Gradle (Kotlin DSL)
- Spring Web MVC, Spring Data JPA (Specifications for search), Bean Validation
- Spring Security with stateless **JWT** (jjwt), BCrypt passwords
- **ModelMapper** for all entity ↔ DTO mapping
- **Firebase Admin SDK** for push notifications (FCM)
- PostgreSQL (H2 in-memory for tests), Lombok, springdoc-openapi (Swagger UI)

## Project structure
Same layout as the `many to many` reference project:
```
src/main/java/com/api/v1/library
├── LibraryApplication.java
├── common/
│   ├── enumerates/        Role, CopyStatus, LoanStatus, … , BookSortEnum, DevicePlatform
│   ├── event/             NotificationCreatedEvent (push after commit)
│   └── response/          SuccessResponse, PaginationResponse, ErrorResponse
├── config/                Mapper (ModelMapper type maps), SecurityConfig, JwtAuthFilter,
│                          FirebaseConfig, OpenApiConfig, DataSeeder
├── controller/            REST endpoints under /api/v1
├── exception/             CustomException, GlobalExceptionHandler
├── model/
│   ├── entity/            JPA entities
│   ├── request/           create / action bodies
│   ├── response/          response payloads
│   └── update/            update bodies (BookUpdate, UserUpdate, SettingsUpdate, …)
├── repository/            Spring Data repositories
├── service/               service interfaces
│   └── serviceImpl/       implementations
└── util/                  APIResponseUtil, ResponseMapper, JwtUtil, QrCodes, TimeUtil
```

### Response format
Every endpoint returns `SuccessResponse` (`{message, status, code, localDateTime, payload}`). Lists return `PaginationResponse`, which adds `page, size, totalElements, totalPages, hasNext…`, and take `page` (1-based), `size` (max 100) and `direction`. Errors return `ErrorResponse` with the real HTTP status (404, 422, …). This is the one difference from the reference project, which answers 200 for everything.

### Mapping and N+1
- ModelMapper does all the mapping. `config/Mapper` declares explicit type maps (STRICT matching), so nested values such as `loan.member.user.name → memberName` are never guessed.
- `util/ResponseMapper` adds the computed values (copy availability, loan counts, queue positions, days late). It does this **for a whole page at once**: one `GROUP BY` / `IN` query per list, never one per row.
- List queries use `@EntityGraph` to fetch associations in the same SELECT. `hibernate.default_batch_fetch_size=50` is a safety net.
- `QueryCountTest` checks that list endpoints run the same number of SQL statements whether the page holds 5 or 50 rows.

## Setup
1. Start PostgreSQL. The bundled Docker Compose file creates `library_db`:
   ```bash
   docker compose up -d
   ```
2. If your PostgreSQL user or password isn't `postgres` / `postgres`, change them in [src/main/resources/application.properties](src/main/resources/application.properties). Also change `app.jwt.secret` before any real deployment.
3. Run it:
   ```bash
   gradlew.bat bootRun      # Windows
   ./gradlew bootRun        # macOS / Linux
   ```
   On first start with an empty database it seeds demo data: 2 librarians, 10 students, 25 titles, 52 copies, loan history, an overdue loan and a reservation.
4. Tests: `gradlew test`. They use H2, so no Docker is needed. They cover the full checkout flow, roles, pagination and errors, push targeting and the N+1 guard.

Swagger UI: http://localhost:8081/swagger-ui.html. Call `POST /api/v1/auth/login`, then click **Authorize** and paste the `token`.

## Push notifications (Firebase Cloud Messaging)
Every in-app notification (checkout approved or rejected, due soon, overdue, return receipt, reservation ready, membership changes, new requests for librarians) is also pushed to the recipient's phone.

**Who receives it.** The `device_tokens` table links each phone's FCM token to the one user currently signed in on it:
- **Sign in** with `deviceToken`: the phone is linked to that user. If someone else used the phone before, it's taken over, so their notifications stop appearing there.
- **Sign out** (`POST /api/v1/auth/logout` with the `deviceToken`): the phone is unlinked and receives nothing.
- **Deactivating or deleting** an account removes all of its devices.
- Pushes go out **after the database transaction commits**. The device list is looked up at that moment, so a rolled-back action never notifies anyone, and a device that just signed out isn't used.
- Tokens that Firebase reports as dead (app uninstalled) are deleted automatically.

**Enable it:**
1. Firebase console → your project → Project settings → Service accounts → **Generate new private key**. Save it outside the repo; `firebase-service-account.json` is git-ignored.
2. Start the API with the file's path:
   ```bash
   # Windows PowerShell
   $env:FIREBASE_CREDENTIALS="C:\secrets\firebase-service-account.json"; .\gradlew.bat bootRun
   # macOS / Linux
   FIREBASE_CREDENTIALS=/secrets/firebase-service-account.json ./gradlew bootRun
   ```
   Without it, the API still works and push sends are only logged (`[push disabled] would send …`).
3. Set up the app side as described in [../library_app/README.md](../library_app/README.md) (`google-services.json` etc.).

## Demo accounts
| Role | Login | Password |
|---|---|---|
| Librarian | librarian@library.com (also d.okafor@library.com) | library123 |
| Student | student@library.com or `STU-10231` | student123 |

The other students are `STU-10232` to `STU-10240` and use the same password. Marcus (`STU-10233`) has an overdue book, so borrowing is blocked for him. Sofia (`STU-10239`) is suspended, and James (`STU-10240`) has an expired membership.

## How a checkout works
1. **Student** scans the QR label inside a book (`POST /api/v1/me/cart`). This only adds it to the cart.
2. **Student** generates a checkout QR (`POST /api/v1/me/checkout`). It holds a random token, expires after 10 minutes, and rotates on refresh.
3. **Librarian** taps the centre **Scan** button. `POST /api/v1/scan/resolve` recognises any code and tells the app which screen to open.
4. **Librarian** scans each book being handed over (`/handover`). If it's a different copy of the same title, the request switches to it.
5. **Librarian** approves. The request and copies are row-locked and every rule is checked again. Copies become `BORROWED`, due dates are set, and the student gets a push.
6. Returns (`POST /api/v1/returns`) issue a receipt. Books returned in the same visit share one receipt.
