package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.entity.BorrowRequestItem;
import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.ApproveResponse;
import com.api.v1.library.model.response.BorrowRequestResponse;
import com.api.v1.library.model.response.CheckResponse;
import com.api.v1.library.model.response.EligibilityResponse;
import com.api.v1.library.model.response.HandoverResponse;
import com.api.v1.library.model.response.LoanResponse;
import com.api.v1.library.model.response.ReviewResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.BorrowRequestRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.repository.UserRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CartService;
import com.api.v1.library.service.CheckoutService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.SettingsService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;
import com.api.v1.library.util.TimeUtil;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Checkout requests: the student generates a QR pass from their cart, the librarian
 * scans it, scans each book being handed over, and approves. Copies become BORROWED
 * and due dates are set only at approval.
 */
@Service
@RequiredArgsConstructor
public class CheckoutServiceImpl implements CheckoutService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)
            .withZone(java.time.ZoneId.systemDefault());

    private final BorrowRequestRepository requestRepository;
    private final BookCopyRepository copyRepository;
    private final LoanRepository loanRepository;
    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final CartService cartService;
    private final EligibilityService eligibilityService;
    private final SettingsService settingsService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    /* ------------------------------------------------------------------ */
    /* Student side                                                         */
    /* ------------------------------------------------------------------ */

    /** "Generate checkout QR": creates a PENDING_APPROVAL request holding an opaque token. */
    @Transactional
    public BorrowRequestResponse create() {
        Member m = currentUser.member();
        List<BookCopy> cart = cartService.copies(m);
        if (cart.isEmpty()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Your cart is empty.");
        EligibilityResponse el = eligibilityService.eligibility(m, cart.size());
        if (!el.isOk()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, el.getErrors().get(0));
        for (BookCopy c : cart) {
            EligibilityService.CopyCheck chk = eligibilityService.copyCheck(c, m, null);
            if (!chk.ok()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, c.getId() + ": " + chk.error());
        }

        // Only one live request per member: supersede any previous pending one.
        requestRepository.findFirstByMemberIdAndStatusOrderByRequestedAtDesc(m.getId(), RequestStatus.PENDING_APPROVAL)
                .ifPresent(prev -> {
                    prev.setStatus(RequestStatus.CANCELLED);
                    prev.setProcessedAt(Instant.now());
                });

        LibrarySettings p = settingsService.settings();
        Instant now = Instant.now();
        BorrowRequest req = BorrowRequest.builder()
                .code(uniqueCode())
                .token(QrCodes.randomToken(24))
                .member(m)
                .status(RequestStatus.PENDING_APPROVAL)
                .requestedAt(now)
                .expiresAt(now.plus(Duration.ofMinutes(p.getRequestExpiryMin())))
                .build();
        for (BookCopy c : cart) {
            req.getItems().add(BorrowRequestItem.builder().request(req).copy(c).book(c.getBook()).build());
        }
        req = requestRepository.save(req);

        String name = m.getUser().getName();
        String summary = name + " requested " + EligibilityService.plural(cart.size(), "book") + " (" + req.getCode() + ").";
        for (User staff : userRepository.findByRoleAndActiveTrue(Role.LIBRARIAN)) {
            notificationService.notify(staff, "REQUEST_NEW", "New checkout request", summary, "requestReview", req.getId());
        }
        auditService.log("REQUEST_CREATED", name + " generated checkout " + req.getCode() + " for "
                + EligibilityService.plural(cart.size(), "book"), req.getId(), m.getUser());
        return mapper.toRequest(req, true);
    }

    /** The student's live pending request, or null. */
    @Transactional(readOnly = true)
    public BorrowRequestResponse current() {
        Member m = currentUser.member();
        return requestRepository.findFirstByMemberIdAndStatusOrderByRequestedAtDesc(m.getId(), RequestStatus.PENDING_APPROVAL)
                .filter(r -> r.getExpiresAt().isAfter(Instant.now()))
                .map(r -> mapper.toRequest(r, true))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public BorrowRequestResponse mine(Long id) {
        return mapper.toRequest(ownRequest(id), true);
    }

    /**
     * Keeps a pending checkout alive while the student is showing the pass. The token
     * is rotated each time, so an old screenshot of the code stops working.
     */
    @Transactional
    public BorrowRequestResponse refresh(Long id) {
        BorrowRequest r = ownRequest(id);
        if (r.getStatus() != RequestStatus.PENDING_APPROVAL) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This checkout is no longer pending.");
        }
        r.setToken(QrCodes.randomToken(24));
        r.setExpiresAt(Instant.now().plus(Duration.ofMinutes(settingsService.settings().getRequestExpiryMin())));
        return mapper.toRequest(r, true);
    }

    @Transactional
    public BorrowRequestResponse cancelMine(Long id) {
        BorrowRequest r = ownRequest(id);
        if (r.getStatus() != RequestStatus.PENDING_APPROVAL) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Only pending requests can be cancelled.");
        }
        r.setStatus(RequestStatus.CANCELLED);
        r.setProcessedAt(Instant.now());
        auditService.log("REQUEST_CANCELLED", "Checkout " + r.getCode() + " cancelled", r.getId(), currentUser.user());
        return mapper.toRequest(r, true);
    }

    private BorrowRequest ownRequest(Long id) {
        Member m = currentUser.member();
        return requestRepository.findById(id)
                .filter(r -> r.getMember().getId().equals(m.getId()))
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Checkout request not found with id: " + id));
    }

    /* ------------------------------------------------------------------ */
    /* Librarian side                                                       */
    /* ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    @Override
    public Page<BorrowRequestResponse> list(int page, int size, Sort.Direction direction, RequestStatus status) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(direction, "requestedAt", "id"));
        Page<BorrowRequest> rs = status == null
                ? requestRepository.findAllBy(pageable)
                : requestRepository.findByStatus(status, pageable);
        return new PageImpl<>(mapper.toRequests(rs.getContent()), pageable, rs.getTotalElements());
    }

    /** Finds a request from a scanned pass (LMS-REQ:token) or a typed code (CR-XXXXXX). */
    @Transactional(readOnly = true)
    public BorrowRequest findByScan(String text) {
        QrCodes.Parsed p = QrCodes.parse(text);
        return switch (p.type()) {
            case REQUEST -> requestRepository.findByToken(p.value()).orElse(null);
            case REQUEST_CODE -> requestRepository.findByCodeIgnoreCase(p.value()).orElse(null);
            default -> requestRepository.findByToken(text == null ? "" : text.trim()).orElse(null);
        };
    }

    @Transactional(readOnly = true)
    public ReviewResponse review(Long id) {
        return buildReview(getOrThrow(id));
    }

    /**
     * Librarian scans a physical book while handing it over, so the loan is recorded
     * against the copy that actually leaves the desk:
     * the requested copy -> marked scanned; another copy of the same title -> the request
     * switches to it; anything else -> refused.
     */
    @Transactional
    public HandoverResponse handover(Long id, String code) {
        User staff = currentUser.user();
        BorrowRequest req = requestRepository.lockById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Checkout request not found with id: " + id));
        if (req.getStatus() != RequestStatus.PENDING_APPROVAL) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This checkout is no longer pending.");
        }
        String copyId = QrCodes.normalizeCopyId(code);

        BorrowRequestItem exact = req.getItems().stream()
                .filter(i -> i.getCopy().getId().equals(copyId)).findFirst().orElse(null);
        if (exact != null) {
            if (exact.getVerifiedAt() != null) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Already scanned.");
            exact.setVerifiedAt(Instant.now());
            exact.setVerifiedBy(staff);
            return HandoverResponse.builder().swapped(false).copyId(copyId)
                    .bookTitle(exact.getBook().getTitle()).review(buildReview(req)).build();
        }

        BookCopy copy = copyRepository.findById(copyId)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No book copy found with ID " + copyId + "."));
        Book book = copy.getBook();
        BorrowRequestItem target = req.getItems().stream()
                .filter(i -> i.getBook().getId().equals(book.getId()) && i.getVerifiedAt() == null)
                .findFirst().orElse(null);
        if (target == null) {
            boolean sameTitle = req.getItems().stream().anyMatch(i -> i.getBook().getId().equals(book.getId()));
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, sameTitle
                    ? "This title has already been scanned."
                    : "“" + book.getTitle() + "” is not part of this checkout.");
        }
        EligibilityService.CopyCheck chk = eligibilityService.copyCheck(copy, req.getMember(), req.getId());
        if (!chk.ok()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, chk.error());

        // Same title, different physical copy: record the one actually being lent.
        String from = target.getCopy().getId();
        target.setCopy(copy);
        target.setVerifiedAt(Instant.now());
        target.setVerifiedBy(staff);
        target.setSwappedFrom(from);
        Member m = req.getMember();
        m.getCart().replaceAll(cid -> cid.equals(from) ? copyId : cid);
        auditService.log("HANDOVER_SWAP", req.getCode() + ": " + from + " → " + copyId
                + " (“" + book.getTitle() + "”)", req.getId(), staff);
        return HandoverResponse.builder().swapped(true).from(from).copyId(copyId)
                .bookTitle(book.getTitle()).review(buildReview(req)).build();
    }

    /**
     * Approves a checkout. The request and its copies are row-locked and every rule is
     * re-checked immediately before writing, so a request can never be approved twice and
     * a copy can never be lent to two people. Due dates are generated here.
     */
    @Transactional
    public ApproveResponse approve(Long id) {
        User staff = currentUser.user();
        BorrowRequest req = requestRepository.lockById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Checkout request not found with id: " + id));
        copyRepository.lockAll(req.getItems().stream().map(i -> i.getCopy().getId()).toList());

        ReviewResponse rv = buildReview(req);
        if (!rv.isOk()) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, rv.getChecks().stream().filter(c -> !c.isOk())
                    .findFirst().map(CheckResponse::getDetail).orElse("This checkout cannot be approved."));
        }

        LibrarySettings p = settingsService.settings();
        Instant now = Instant.now();
        Instant dueAt = TimeUtil.endOfDay(now.plus(Duration.ofDays(p.getLoanDays())));
        Member m = req.getMember();
        List<Loan> loans = new ArrayList<>();
        for (BorrowRequestItem it : req.getItems()) {
            it.getCopy().setStatus(CopyStatus.BORROWED);
            reservationRepository.findFirstByMemberIdAndBookIdAndStatusIn(m.getId(), it.getBook().getId(),
                            ReservationService.LIVE)
                    .ifPresent(r -> r.setStatus(ReservationStatus.FULFILLED));
            loans.add(loanRepository.save(Loan.builder()
                    .request(req).member(m).copy(it.getCopy()).book(it.getBook())
                    .borrowedAt(now).dueAt(dueAt).status(LoanStatus.ACTIVE).approvedBy(staff)
                    .build()));
        }
        req.setStatus(RequestStatus.APPROVED);
        req.setProcessedAt(now);
        req.setProcessedBy(staff);
        Set<String> approved = req.getItems().stream().map(i -> i.getCopy().getId()).collect(Collectors.toSet());
        m.getCart().removeIf(approved::contains);

        String titles = req.getItems().stream().map(i -> "“" + i.getBook().getTitle() + "”")
                .collect(Collectors.joining(", "));
        notificationService.notify(m.getUser(), "CHECKOUT_APPROVED", "Checkout approved",
                titles + (loans.size() > 1 ? " are" : " is") + " due on " + EligibilityService.DATE.format(dueAt) + ".",
                "mybooks", null);
        auditService.log("CHECKOUT_APPROVED", req.getCode() + ": " + EligibilityService.plural(loans.size(), "book")
                + " → " + m.getUser().getName(), req.getId(), staff);

        List<LoanResponse> loanDtos = mapper.toLoans(loans);
        return ApproveResponse.builder().request(mapper.toRequest(req, false)).loans(loanDtos).dueAt(dueAt).build();
    }

    @Transactional
    public BorrowRequestResponse reject(Long id, String reason) {
        User staff = currentUser.user();
        BorrowRequest r = requestRepository.lockById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Checkout request not found with id: " + id));
        if (r.getStatus() != RequestStatus.PENDING_APPROVAL) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This request was already " + r.getStatus().name().toLowerCase(Locale.ROOT) + ".");
        }
        String why = reason == null || reason.isBlank() ? "Rejected at counter" : reason.trim();
        r.setStatus(RequestStatus.REJECTED);
        r.setProcessedAt(Instant.now());
        r.setProcessedBy(staff);
        r.setRejectReason(why);
        notificationService.notify(r.getMember().getUser(), "CHECKOUT_REJECTED", "Checkout rejected", why, "mybooks", null);
        auditService.log("REQUEST_REJECTED", r.getCode() + " rejected for " + r.getMember().getUser().getName()
                + ": " + why, r.getId(), staff);
        return mapper.toRequest(r, false);
    }

    /** Everything the librarian needs to decide on a request: checks + items. */
    private ReviewResponse buildReview(BorrowRequest req) {
        Member m = req.getMember();
        boolean pending = req.getStatus() == RequestStatus.PENDING_APPROVAL;
        List<ReviewResponse.Item> items = req.getItems().stream().map(i -> {
            EligibilityService.CopyCheck c = eligibilityService.copyCheck(i.getCopy(), m, req.getId());
            return ReviewResponse.Item.builder()
                    .id(i.getId())
                    .copyId(i.getCopy().getId())
                    .bookId(i.getBook().getId())
                    .bookTitle(i.getBook().getTitle())
                    .bookAuthor(i.getBook().getAuthor())
                    .verified(i.getVerifiedAt() != null)
                    .swappedFrom(i.getSwappedFrom())
                    .ok(c.ok())
                    .issue(c.ok() ? null : c.error())
                    .build();
        }).toList();

        List<CheckResponse> checks = new ArrayList<>();
        checks.add(EligibilityService.check("state", "Request not yet processed", pending, pending
                ? "Awaiting approval"
                : "Already " + req.getStatus().name().replace('_', ' ').toLowerCase(Locale.ROOT)));
        if (pending) {
            boolean valid = req.getExpiresAt().isAfter(Instant.now());
            checks.add(EligibilityService.check("expiry", "QR code still valid", valid,
                    (valid ? "Expires " : "Expired at ") + TIME.format(req.getExpiresAt())));
        }
        EligibilityResponse el = eligibilityService.eligibility(m, items.size());
        checks.addAll(el.getChecks());

        Set<String> unique = new HashSet<>(items.stream().map(ReviewResponse.Item::getCopyId).toList());
        boolean dup = unique.size() != items.size();
        checks.add(EligibilityService.check("dup", "No duplicate copies", !dup,
                dup ? "The same copy appears twice" : items.size() + (items.size() == 1 ? " unique copy" : " unique copies")));

        long issues = items.stream().filter(i -> !i.isOk()).count();
        boolean allAvailable = !items.isEmpty() && issues == 0;
        checks.add(EligibilityService.check("avail", "All copies available", allAvailable,
                allAvailable ? "Every copy can be checked out" : issues + " copy issue(s)"));

        int scanned = (int) items.stream().filter(ReviewResponse.Item::isVerified).count();
        boolean needScan = settingsService.settings().isRequireHandoverScan();
        if (needScan && pending) {
            checks.add(EligibilityService.check("handover", "Books scanned at desk", scanned == items.size(),
                    scanned + " of " + items.size() + " scanned"));
        }

        return ReviewResponse.builder()
                .request(mapper.toRequest(req, false))
                .member(mapper.toMember(m))
                .checks(checks)
                .items(items)
                .ok(checks.stream().allMatch(CheckResponse::isOk))
                .scanned(scanned)
                .needScan(needScan)
                .build();
    }

    private BorrowRequest getOrThrow(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Checkout request not found with id: " + id));
    }

    private String uniqueCode() {
        String code;
        do {
            code = "CR-" + QrCodes.randomToken(6);
        } while (requestRepository.existsByCode(code));
        return code;
    }
}
