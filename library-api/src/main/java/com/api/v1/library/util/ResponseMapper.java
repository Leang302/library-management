package com.api.v1.library.util;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.model.entity.AuditLog;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.model.entity.Receipt;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.AuditLogResponse;
import com.api.v1.library.model.response.BookResponse;
import com.api.v1.library.model.response.BorrowRequestResponse;
import com.api.v1.library.model.response.CopyResponse;
import com.api.v1.library.model.response.LoanResponse;
import com.api.v1.library.model.response.MemberResponse;
import com.api.v1.library.model.response.NotificationResponse;
import com.api.v1.library.model.response.ReceiptResponse;
import com.api.v1.library.model.response.ReservationResponse;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.ReservationRepository;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Entity -> DTO conversion. ModelMapper copies the fields (type maps in ModelMapperConfig);
 * this class only adds values that need a calculation or a lookup.
 *
 * Every lookup is done for the whole list at once — one GROUP BY / IN query per list,
 * never one query per row — so list endpoints don't suffer from N+1 queries.
 * The single-item methods simply delegate to the list versions.
 * Call from inside a transaction.
 */
@Component
@RequiredArgsConstructor
public class ResponseMapper {

    /** Loan statuses that mean the book is still out. */
    public static final List<LoanStatus> OPEN_LOAN = List.of(LoanStatus.ACTIVE, LoanStatus.OVERDUE);

    private final ModelMapper modelMapper;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final BookCopyRepository copyRepository;
    private final ReservationRepository reservationRepository;

    /* ---------------- users & members ---------------- */

    public UserResponse toUser(User u) {
        return toUsers(List.of(u)).get(0);
    }

    public List<UserResponse> toUsers(List<User> users) {
        if (users.isEmpty()) return List.of();
        List<Member> members = memberRepository.findByUserIdIn(ids(users, User::getId));
        Map<Long, MemberResponse> byUser = toMembers(members).stream()
                .collect(Collectors.toMap(MemberResponse::getUserId, Function.identity()));
        return users.stream().map(u -> {
            UserResponse dto = map(u, UserResponse.class);
            dto.setMember(byUser.get(u.getId()));
            return dto;
        }).toList();
    }

    public MemberResponse toMember(Member m) {
        return toMembers(List.of(m)).get(0);
    }

    /** Open / overdue loan counts for every member come from one GROUP BY query. */
    public List<MemberResponse> toMembers(Collection<Member> members) {
        if (members.isEmpty()) return List.of();
        Map<Long, Map<LoanStatus, Long>> counts = new HashMap<>();
        for (Object[] row : loanRepository.countByMemberAndStatus(ids(members, Member::getId), OPEN_LOAN)) {
            counts.computeIfAbsent((Long) row[0], k -> new EnumMap<>(LoanStatus.class))
                    .put((LoanStatus) row[1], (Long) row[2]);
        }
        return members.stream().map(m -> {
            MemberResponse dto = map(m, MemberResponse.class);
            Map<LoanStatus, Long> c = counts.getOrDefault(m.getId(), Map.of());
            long overdue = c.getOrDefault(LoanStatus.OVERDUE, 0L);
            dto.setActiveLoans((int) (c.getOrDefault(LoanStatus.ACTIVE, 0L) + overdue));
            dto.setOverdueLoans((int) overdue);
            return dto;
        }).toList();
    }

    /* ---------------- books & copies ---------------- */

    public BookResponse toBook(Book b) {
        return toBooks(List.of(b)).get(0);
    }

    /** Copy availability for every book comes from one GROUP BY query. */
    public List<BookResponse> toBooks(List<Book> books) {
        if (books.isEmpty()) return List.of();
        Map<Long, Map<CopyStatus, Long>> counts = new HashMap<>();
        for (Object[] row : copyRepository.countByBookAndStatus(ids(books, Book::getId))) {
            counts.computeIfAbsent((Long) row[0], k -> new EnumMap<>(CopyStatus.class))
                    .put((CopyStatus) row[1], (Long) row[2]);
        }
        return books.stream().map(b -> {
            BookResponse dto = map(b, BookResponse.class);
            Map<CopyStatus, Long> c = counts.getOrDefault(b.getId(), Map.of());
            Function<CopyStatus, Integer> n = s -> c.getOrDefault(s, 0L).intValue();
            int all = c.values().stream().mapToInt(Long::intValue).sum();
            dto.setTotalCopies(all - n.apply(CopyStatus.LOST));
            dto.setAvailableCopies(n.apply(CopyStatus.AVAILABLE));
            dto.setBorrowedCopies(n.apply(CopyStatus.BORROWED));
            dto.setReservedCopies(n.apply(CopyStatus.RESERVED));
            return dto;
        }).toList();
    }

    public CopyResponse toCopy(BookCopy c, boolean withLoan) {
        return toCopies(List.of(c), withLoan).get(0);
    }

    /** With {@code withLoan}, the current loans of all copies come from one query. */
    public List<CopyResponse> toCopies(List<BookCopy> copies, boolean withLoan) {
        if (copies.isEmpty()) return List.of();
        Map<String, LoanResponse> loans = !withLoan ? Map.of()
                : toLoans(loanRepository.findByCopyIdInAndStatusIn(ids(copies, BookCopy::getId), OPEN_LOAN)).stream()
                .collect(Collectors.toMap(LoanResponse::getCopyId, Function.identity(), (a, b) -> a));
        return copies.stream().map(c -> {
            CopyResponse dto = map(c, CopyResponse.class);
            dto.setCurrentLoan(loans.get(c.getId()));
            return dto;
        }).toList();
    }

    /* ---------------- loans & requests ---------------- */

    public LoanResponse toLoan(Loan l) {
        return toLoans(List.of(l)).get(0);
    }

    /** Fetch loans with LoanRepository's entity graph so book / member are already loaded. */
    public List<LoanResponse> toLoans(List<Loan> loans) {
        Instant now = Instant.now();
        return loans.stream().map(l -> {
            LoanResponse dto = map(l, LoanResponse.class);
            dto.setDaysLate(TimeUtil.daysLate(l.getDueAt(), l.getReturnedAt() != null ? l.getReturnedAt() : now));
            return dto;
        }).toList();
    }

    /** {@code withQr} only for the student who owns the request. */
    public BorrowRequestResponse toRequest(BorrowRequest r, boolean withQr) {
        BorrowRequestResponse dto = map(r, BorrowRequestResponse.class);
        if (withQr) dto.setQrPayload(QrCodes.REQUEST_PREFIX + r.getToken());
        return dto;
    }

    public List<BorrowRequestResponse> toRequests(List<BorrowRequest> requests) {
        return requests.stream().map(r -> toRequest(r, false)).toList();
    }

    /* ---------------- reservations ---------------- */

    public ReservationResponse toReservation(Reservation r) {
        return toReservations(List.of(r)).get(0);
    }

    /** Queue positions for every waiting reservation come from one query over the affected titles. */
    public List<ReservationResponse> toReservations(List<Reservation> reservations) {
        if (reservations.isEmpty()) return List.of();
        List<Long> waitingBooks = reservations.stream()
                .filter(r -> r.getStatus() == ReservationStatus.WAITING)
                .map(r -> r.getBook().getId()).distinct().toList();
        Map<Long, Integer> position = new HashMap<>();
        if (!waitingBooks.isEmpty()) {
            Map<Long, Integer> nextInQueue = new HashMap<>();
            for (Reservation q : reservationRepository.findByBookIdInAndStatusOrderByCreatedAtAscIdAsc(
                    waitingBooks, ReservationStatus.WAITING)) {
                position.put(q.getId(), nextInQueue.merge(q.getBook().getId(), 1, Integer::sum));
            }
        }
        return reservations.stream().map(r -> {
            ReservationResponse dto = map(r, ReservationResponse.class);
            dto.setPosition(position.getOrDefault(r.getId(), 0));
            return dto;
        }).toList();
    }

    /* ---------------- receipts, notifications, audit ---------------- */

    public ReceiptResponse toReceipt(Receipt r) {
        ReceiptResponse dto = map(r, ReceiptResponse.class);
        dto.setQrPayload(QrCodes.RECEIPT_PREFIX + r.getToken());
        for (int i = 0; i < dto.getLines().size(); i++) {
            Loan loan = r.getLines().get(i).getLoan();
            dto.getLines().get(i).setDaysLate(TimeUtil.daysLate(loan.getDueAt(), loan.getReturnedAt()));
        }
        return dto;
    }

    public List<ReceiptResponse> toReceipts(List<Receipt> receipts) {
        return receipts.stream().map(this::toReceipt).toList();
    }

    public NotificationResponse toNotification(Notification n) {
        return map(n, NotificationResponse.class);
    }

    public AuditLogResponse toAuditLog(AuditLog l) {
        AuditLogResponse dto = map(l, AuditLogResponse.class);
        if (dto.getUserName() == null) dto.setUserName("System");
        return dto;
    }

    /* ---------------- helpers ---------------- */

    /**
     * Unwraps Hibernate proxies first so ModelMapper finds the type map registered
     * for the entity class (a lazy proxy is a generated subclass).
     */
    private <T> T map(Object entity, Class<T> type) {
        return modelMapper.map(Hibernate.unproxy(entity), type);
    }

    private static <E, K> List<K> ids(Collection<E> items, Function<E, K> id) {
        return items.stream().map(id).distinct().toList();
    }
}
