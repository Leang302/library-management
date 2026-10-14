# Greenleaf Library — mobile library management prototype

A mobile-first library management app built with HTML, CSS and vanilla JS. Data is stored in `localStorage`. There is no backend.

**Run it:** open `index.html` in a browser. On a desktop it shows inside a phone frame; on a phone it fills the screen. CDN libraries need internet: Chart.js, Lucide, qrcodejs and html5-qrcode. If they don't load, the app still works: charts and QR codes show a text fallback and the scanner falls back to typed codes.

Camera scanning needs `https://` or `http://localhost`, for example `npx serve .` or `python -m http.server`. Every scanner also accepts typed codes and has one-tap "simulate a scan" chips.

## Demo accounts
| Role | Login | Password |
|---|---|---|
| Admin | admin@library.com | admin123 |
| Librarian | librarian@library.com (also d.okafor@library.com) | library123 |
| Student | student@library.com or `STU-10231` | student123 |

The other seeded students all use the password `student123`. **Developer demo tools** (on the sign-in screen and in Profile) let you switch roles, simulate book, membership and checkout scans, generate overdue loans, expire QR codes, export data and reset the demo.

To run a two-device demo, open two tabs and untick **Remember me** in each. The sessions stay separate, data is shared, and the student's checkout QR updates live when the librarian approves it.

## Structure
```
index.html              shell + phone frame
css/app.css             design system
js/core/utils.js        generic helpers
js/core/store.js        DATA ACCESS LAYER (swap for REST later)
js/core/seed.js         demo dataset (dates relative to "now")
js/core/services.js     ALL business rules: auth, eligibility, cart, checkout,
                        approval, returns, fines, reservations, books, stats
js/ui/components.js     render helpers, toasts, bottom sheets, charts, QR
js/ui/router.js         navigation stack, role tab bars, event delegation
js/ui/scanner.js        camera / manual / simulated QR scanner
js/screens/*.js         student, librarian, books, admin, common screens
tests/run-e2e.ps1       headless-Chrome end-to-end test (Windows PowerShell)
```

## Key rules (all in `services.js`)
- Scanning a book only adds it to the cart. A copy becomes `BORROWED` only when a librarian approves the checkout, and the due date is set at that moment.
- Before approving, the librarian scans each physical book being handed over. If it's a different copy of the same title, the request switches to that copy, so the loan always matches the book that left the desk. A book not in the request is refused. Admins can turn this off in Policies.
- Every return and payment produces a receipt in the student's app. Books returned in the same visit share one receipt, and staff can scan a receipt's QR to check it's genuine.
- A checkout QR holds only an opaque random token (`LMS-REQ:<token>`). It expires after 10 minutes, a request can be approved only once, and a copy can be returned only once.
- Before approval, everything is checked again: membership status and expiry, overdue block, unpaid-fine limit, borrowing limit, availability and duplicates.
- **No money in the MVP.** Late returns are tracked (overdue status, reminders, "returned late") but cost nothing, and there are no fees, payments or balances. A damaged return sends the copy to maintenance. When a copy comes back, it is held for the first person in the reservation queue.
- To bring back late fines, damage fees, fine payments and payment receipts, set `FEATURES.fines = true` in [js/core/store.js](js/core/store.js). The fine logic and its tests are kept, and the test suite passes in both modes.
- A title can be deleted only if it has never been borrowed. Otherwise it must be archived.

## ⚠ Before production
- **Authentication is demo-only.** Passwords are stored in plain text in the browser. Replace this with server-side auth.
- **Concurrency.** This prototype runs in a single browser. A real system must validate and apply checkouts inside a server-side database transaction with row locks (`SELECT … FOR UPDATE`) and idempotency keys, so two counters can never lend the same copy.
