# Greenleaf Library — REST API contract

Shared contract between `library-api/` (Spring Boot) and `library_app/` (Flutter).

- Base URL: `http://localhost:8081/api/v1` (Android emulator: `http://10.0.2.2:8081/api/v1`). Every path below is relative to it.
- JSON everywhere. Entity timestamps are ISO-8601 UTC strings (`2026-10-14T09:30:00Z`).
- Auth: `Authorization: Bearer <token>` on every endpoint except `POST /auth/login` and `POST /auth/logout`.
- Roles: `STUDENT` and `LIBRARIAN` (two roles only). "Staff" = LIBRARIAN.

### Response envelope
Every success response wraps the data in `payload`. "Returns X" in the tables below means `payload` is X.
```jsonc
// SuccessResponse
{ "message": "Book retrieved successfully", "status": "OK", "code": 200,
  "localDateTime": "2026-10-14T16:30:00", "payload": { ... } }   // payload omitted when there is none
```
Endpoints marked **(paged)** return a `PaginationResponse`. They take `page` (1-based, default 1) and `size` (default 10, max 100), and sometimes `direction` (`ASC`/`DESC`) and `sort`:
```jsonc
{ "message": "...", "status": "OK", "code": 200, "localDateTime": "...",
  "payload": [ ... ], "page": 1, "size": 10, "totalElements": 25, "totalPages": 3,
  "first": true, "last": false, "empty": false, "hasNext": true, "hasPrevious": false }
```

### Errors
Errors use the real HTTP status (400/401/403/404/409/422/500) and this body:
```json
{ "message": "This copy is currently borrowed.", "status": "Unprocessable Entity", "code": 422,
  "timestamp": "2026-10-14T16:30:00", "path": "/api/v1/me/cart",
  "validationErrors": { "isbn": "ISBN is required" } }
```
`validationErrors` is only present for validation failures (400, `message` = "Invalid Request"). Business-rule failures return **422** with a human-readable `message` the app shows as-is.

### Push notifications
Every in-app notification is also pushed by Firebase Cloud Messaging to the devices the recipient is **currently signed in on**. The data payload has `type`, `notificationId`, and `linkTo` / `linkId` when set.
- Send `deviceToken` (the FCM token) and `platform` at login. That device then gets this user's pushes, and stops getting those of anyone who used it before.
- Call `POST /auth/logout` with the same `deviceToken` when signing out. That device then gets nothing.
- When FCM rotates the token, call `POST /notifications/devices`.

## Enums
| Enum | Values |
|---|---|
| Role | `STUDENT`, `LIBRARIAN` |
| CopyStatus | `AVAILABLE`, `BORROWED`, `RESERVED`, `MAINTENANCE`, `LOST` |
| RequestStatus | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED` |
| LoanStatus | `ACTIVE`, `OVERDUE`, `RETURNED` |
| MemberStatus | `ACTIVE`, `SUSPENDED` |
| ReservationStatus | `WAITING`, `READY`, `FULFILLED`, `CANCELLED`, `EXPIRED` |
| Condition | `GOOD`, `DAMAGED` |
| ScanType | `COPY`, `REQUEST`, `MEMBER`, `RECEIPT`, `UNKNOWN` |

## QR payloads
| Printed on | Payload |
|---|---|
| Book copy label | `BOOKCOPY-000004` (also accepts `4`, `BOOKCOPY4`) |
| Student checkout pass | `LMS-REQ:<token>` (or code `CR-8F3K2A`) |
| Student membership card | `LMS-MEM:<token>` (or student id `STU-10231`) |
| Receipt | `LMS-RCT:<token>` (or number `RT-8K2M4Q`) |

## Shared objects
```jsonc
// User
{ "id": 1, "name": "Sarah Chen", "email": "librarian@library.com", "role": "LIBRARIAN",
  "phone": "+1 555", "title": "Circulation Librarian", "active": true,
  "member": null /* Member, only for STUDENT */ }

// Member
{ "id": 3, "userId": 5, "name": "Alex Morgan", "email": "student@library.com",
  "studentId": "STU-10231", "program": "Computer Science", "year": 3,
  "status": "ACTIVE", "joinedAt": "...", "expiresAt": "...",
  "activeLoans": 2, "overdueLoans": 0 }

// Book
{ "id": 1, "title": "Atomic Habits", "author": "James Clear", "isbn": "9780735211292",
  "publisher": "Avery", "year": 2018, "category": "Self-Help", "language": "English",
  "description": "...", "shelf": "A-01", "pages": 320, "archived": false,
  "totalCopies": 3, "availableCopies": 1, "borrowedCopies": 2, "reservedCopies": 0 }

// Copy
{ "id": "BOOKCOPY-000001", "bookId": 1, "bookTitle": "Atomic Habits", "status": "AVAILABLE",
  "condition": "GOOD", "note": "", "currentLoan": null /* Loan */ }

// Loan (borrow transaction)
{ "id": 10, "requestId": 4, "copyId": "BOOKCOPY-000001", "bookId": 1, "bookTitle": "Atomic Habits",
  "bookAuthor": "James Clear", "memberId": 3, "memberName": "Alex Morgan", "studentId": "STU-10231",
  "borrowedAt": "...", "dueAt": "...", "returnedAt": null, "status": "ACTIVE",
  "condition": null, "daysLate": 0 }

// Check (eligibility / review line)
{ "key": "limit", "label": "Borrowing limit", "ok": true, "detail": "1 borrowed + 1 requested = 2 of 3" }

// Eligibility
{ "ok": true, "checks": [Check], "errors": ["..."], "activeCount": 1, "overdueCount": 0, "remaining": 2 }

// BorrowRequest
{ "id": 4, "code": "CR-8F3K2A", "qrPayload": "LMS-REQ:abc...", "memberId": 3, "memberName": "Alex Morgan",
  "studentId": "STU-10231", "status": "PENDING_APPROVAL", "requestedAt": "...", "expiresAt": "...",
  "processedAt": null, "processedByName": null, "rejectReason": null,
  "items": [ { "id": 7, "copyId": "BOOKCOPY-000001", "bookId": 1, "bookTitle": "Atomic Habits",
               "bookAuthor": "James Clear", "verified": false, "swappedFrom": null } ] }
// qrPayload is only filled for the student who owns the request.

// Reservation
{ "id": 2, "bookId": 7, "bookTitle": "Project Hail Mary", "memberId": 3, "memberName": "Alex Morgan",
  "status": "WAITING", "position": 1, "copyId": null, "readyAt": null, "holdUntil": null, "createdAt": "..." }

// Receipt
{ "id": 1, "type": "RETURN", "number": "RT-8K2M4Q", "qrPayload": "LMS-RCT:...", "memberId": 3,
  "memberName": "Alex Morgan", "staffName": "Sarah Chen", "createdAt": "...",
  "lines": [ { "copyId": "BOOKCOPY-000001", "bookTitle": "Atomic Habits", "dueAt": "...",
               "returnedAt": "...", "condition": "GOOD", "daysLate": 0 } ] }

// Notification
{ "id": 1, "type": "CHECKOUT_APPROVED", "title": "Checkout approved", "body": "...",
  "linkTo": "mybooks", "linkId": null, "read": false, "createdAt": "..." }
```

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ "identifier": "email or STU-id", "password": "...", "deviceToken": "<FCM token, optional>", "platform": "ANDROID\|IOS\|WEB" }` | `{ "token": "jwt", "user": User }` |
| POST | `/auth/logout` | `{ "deviceToken": "<FCM token>" }` (no JWT needed) | no payload — the device stops receiving pushes |
| GET | `/auth/me` | | `User` |

## Catalogue (any signed-in user)
| Method | Path | Notes |
|---|---|---|
| GET | `/books?q=&category=&availableOnly=false&sort=title&direction=ASC` | **(paged)** `sort` = `id\|title\|author\|year\|category\|createdAt`. Non-archived titles (staff also get archived with `includeArchived=true`) → `Book[]` |
| GET | `/books/{id}` | `{ "book": Book, "copies": Copy[], "queueLength": 0, "myReservation": Reservation\|null }` |
| GET | `/books/categories` | `string[]` |

## Student — `/me/*` (STUDENT only)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me/cart` | | `Cart` = `{ "items": [ { "copyId": "...", "book": Book } ], "eligibility": Eligibility }` |
| POST | `/me/cart` | `{ "code": "BOOKCOPY-000004" }` (scanned) | `Cart` |
| POST | `/me/cart/books/{bookId}` | | `Cart` (picks first borrowable copy) |
| DELETE | `/me/cart/{copyId}` | | `Cart` |
| POST | `/me/checkout` | | `BorrowRequest` (new pending request, replaces the old one) |
| GET | `/me/checkout/current` | | `BorrowRequest`, or no `payload` when none is pending |
| GET | `/me/checkout/{id}` | | `BorrowRequest` (poll to see APPROVED/REJECTED) |
| POST | `/me/checkout/{id}/refresh` | | `BorrowRequest` (new token + expiry) |
| POST | `/me/checkout/{id}/cancel` | | `BorrowRequest` |
| GET | `/me/loans?scope=current\|history` | | `Loan[]` |
| GET | `/me/reservations` | | `Reservation[]` |
| POST | `/me/reservations` | `{ "bookId": 7 }` | `Reservation` |
| DELETE | `/me/reservations/{id}` | | no payload |
| GET | `/me/receipts` | | `Receipt[]` |
| GET | `/me/member-card` | | `{ "member": Member, "qrPayload": "LMS-MEM:..." }` |

## Notifications (any signed-in user)
| Method | Path | Returns |
|---|---|---|
| GET | `/notifications` | **(paged, size default 20)** `Notification[]` newest first |
| GET | `/notifications/unread-count` | `{ "count": 3 }` |
| POST | `/notifications/{id}/read` | no payload |
| POST | `/notifications/read-all` | no payload |
| POST | `/notifications/devices` | body `{ "token": "<FCM token>", "platform": "ANDROID" }` — (re)register this device for the signed-in user |

## Librarian desk (staff)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/scan/resolve` | `{ "code": "<raw scanned text>" }` | `{ "type": ScanType, "id": "4" \| "BOOKCOPY-000004" \| null, "label": "Checkout CR-8F3K2A", "suggestedAction": "REVIEW_REQUEST" \| "RETURN" \| "COPY_INFO" \| "MEMBER" \| "RECEIPT" \| null }` |
| GET | `/dashboard/librarian` | | `{ "borrowedToday", "returnedToday", "pending", "overdue", "activeMembers", "availableCopies", "dueToday": Loan[], "pendingRequests": BorrowRequest[], "last7": [ { "label": "Mon", "borrowed": 2, "returned": 1 } ] }` |
| GET | `/requests?status=PENDING_APPROVAL&direction=DESC` | | **(paged)** `BorrowRequest[]` |
| GET | `/requests/{id}/review` | | `Review` = `{ "request": BorrowRequest, "member": Member, "checks": Check[], "items": [ { ...item, "ok": true, "issue": null } ], "ok": false, "scanned": 1, "needScan": true }` |
| POST | `/requests/{id}/handover` | `{ "code": "BOOKCOPY-000002" }` | `{ "swapped": true, "from": "BOOKCOPY-000001", "copyId": "BOOKCOPY-000002", "bookTitle": "...", "review": Review }` |
| POST | `/requests/{id}/approve` | | `{ "request": BorrowRequest, "loans": Loan[], "dueAt": "..." }` |
| POST | `/requests/{id}/reject` | `{ "reason": "..." }` | `BorrowRequest` |
| GET | `/returns/preview?code=BOOKCOPY-000001` | | `{ "copy": Copy, "book": Book, "loan": Loan, "member": Member }` |
| POST | `/returns` | `{ "code": "BOOKCOPY-000001", "condition": "GOOD", "note": "", "receiptId": null }` | `{ "loan": Loan, "copyStatus": "AVAILABLE", "heldForName": null, "receipt": Receipt }` (pass the previous `receipt.id` back to add more books to the same receipt) |
| GET | `/loans?status=ALL&q=&direction=DESC` | | **(paged)** `Loan[]`; `status` = `ALL`, `ACTIVE` (open, incl. overdue), `OVERDUE` or `RETURNED` |
| GET | `/copies/{copyId}` | | `Copy` |
| PATCH | `/copies/{copyId}/status` | `{ "status": "MAINTENANCE", "note": "" }` | `Copy` |
| GET | `/members?q=&direction=ASC` | | **(paged)** `Member[]` sorted by name |
| GET | `/members/{id}` | | `{ "member": Member, "loans": Loan[], "reservations": Reservation[], "eligibility": Eligibility }` |
| PATCH | `/members/{id}/status` | `{ "status": "SUSPENDED" }` | `Member` |
| POST | `/members/{id}/renew` | | `Member` |
| GET | `/receipts/verify?code=LMS-RCT:...` | | `Receipt` |
| GET | `/reservations?status=WAITING` | | **(paged)** `Reservation[]` |
| DELETE | `/reservations/{id}` | | no payload (staff cancel any reservation; a READY hold goes to the next in queue) |

### Book management (staff)
| Method | Path | Body |
|---|---|---|
| POST | `/books` | `BookRequest` = `{ title, author, isbn, publisher, year, category, language, description, shelf, pages, copies }` → `Book` |
| PUT | `/books/{id}` | `BookUpdate` = `BookRequest` without `copies` → `Book` |
| POST | `/books/{id}/copies` | `{ "count": 2 }` → `Copy[]` |
| PATCH | `/books/{id}/archive` | `{ "archived": true }` → `Book` |
| DELETE | `/books/{id}` | no payload, or 422 if the title was ever borrowed |

## Library management (LIBRARIAN)
| Method | Path | Body / Returns |
|---|---|---|
| GET | `/users?role=&q=&direction=ASC` | **(paged)** `User[]` |
| POST | `/users` | `{ name, email, password, role, phone, title, studentId, program, year }` → `User` |
| PUT | `/users/{id}` | `{ name, email, phone, title, role, active, password? }` → `User` (deactivating also signs the user out of push on all devices) |
| DELETE | `/users/{id}` | no payload, or 422 if they have history |
| GET | `/settings` | `Settings` |
| PUT | `/settings` | `Settings` = `{ libraryName, maxBorrow, loanDays, requestExpiryMin, blockOnOverdue, requireHandoverScan, reservationHoldDays, dueSoonDays }` |
| GET | `/dashboard/reports?days=30` | `{ "borrowed", "returned", "overdue", "lost", "totalCopies", "totalTitles", "activeMembers", "newMembers", "topBooks": [ { "bookId", "title", "count" } ], "categories": [ { "name", "count" } ] }` |
| GET | `/audit-logs` | **(paged, size default 20)** `[ { "id", "action", "detail", "userName", "createdAt" } ]` |

## Demo accounts (seeded on first start)
| Role | Login | Password |
|---|---|---|
| Librarian | librarian@library.com | library123 |
| Student | student@library.com or STU-10231 | student123 |
