package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.ReservationResponse;
import com.api.v1.library.repository.BookRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.SettingsService;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {

    private final ReservationRepository reservationRepository;
    private final BookRepository bookRepository;
    private final LoanRepository loanRepository;
    private final SettingsService settingsService;
    private final EligibilityService eligibilityService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    /**
     * When a copy becomes available, hold it for the next member in the queue.
     * Returns that member, or null when nobody is waiting.
     */
    @Transactional
    public Member assignToQueue(BookCopy copy) {
        if (copy.getStatus() != CopyStatus.AVAILABLE) return null;
        List<Reservation> queue = reservationRepository
                .findByBookIdAndStatusOrderByCreatedAtAscIdAsc(copy.getBook().getId(), ReservationStatus.WAITING);
        if (queue.isEmpty()) return null;

        LibrarySettings p = settingsService.settings();
        Reservation next = queue.get(0);
        next.setStatus(ReservationStatus.READY);
        next.setCopy(copy);
        next.setReadyAt(Instant.now());
        next.setHoldUntil(TimeUtil.endOfDay(Instant.now().plus(Duration.ofDays(p.getReservationHoldDays()))));
        copy.setStatus(CopyStatus.RESERVED);

        Member member = next.getMember();
        notificationService.notify(member.getUser(), "RESERVATION_READY", "Reservation available",
                "“" + copy.getBook().getTitle() + "” is waiting for you. Pick it up within "
                        + EligibilityService.plural(p.getReservationHoldDays(), "day") + ".",
                "mybooks", null);
        return member;
    }

    @Transactional
    public ReservationResponse reserve(Long bookId) {
        Member m = currentUser.member();
        Book book = bookRepository.findById(bookId)
                .filter(b -> !b.isArchived())
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Book not found with id: " + bookId));
        if (!eligibilityService.isMembershipValid(m)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Your membership must be active to reserve books.");
        }
        if (book.getCopies().stream().anyMatch(c -> c.getStatus() == CopyStatus.AVAILABLE)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Copies are available — add one to your cart instead.");
        }
        if (reservationRepository.findFirstByMemberIdAndBookIdAndStatusIn(m.getId(), bookId, LIVE).isPresent()) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "You already have a reservation for this title.");
        }
        boolean borrowing = loanRepository.findByMemberIdAndStatusInOrderByDueAtAsc(m.getId(), ResponseMapper.OPEN_LOAN)
                .stream().anyMatch(l -> l.getBook().getId().equals(bookId));
        if (borrowing) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "You are currently borrowing this title.");

        Reservation r = reservationRepository.save(Reservation.builder()
                .member(m).book(book).status(ReservationStatus.WAITING).build());
        ReservationResponse dto = mapper.toReservation(r);
        notificationService.notify(m.getUser(), "RESERVATION_QUEUED", "You’re #" + dto.getPosition() + " in the queue",
                "We’ll notify you when “" + book.getTitle() + "” is available.", "bookDetail", book.getId());
        auditService.log("RESERVATION_CREATED", m.getUser().getName() + " reserved “" + book.getTitle()
                + "” (#" + dto.getPosition() + ")", r.getId(), m.getUser());
        return dto;
    }

    /** Student cancels one of their own reservations. */
    @Transactional
    public void cancelMine(Long id) {
        cancel(id, currentUser.member());
    }

    /** Staff cancel any reservation. */
    @Transactional
    public void cancelAny(Long id) {
        cancel(id, null);
    }

    private void cancel(Long id, Member owner) {
        User by = currentUser.user();
        Reservation r = reservationRepository.findById(id)
                .filter(x -> owner == null || x.getMember().getId().equals(owner.getId()))
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Reservation not found with id: " + id));
        if (!LIVE.contains(r.getStatus())) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This reservation cannot be cancelled.");
        boolean wasReady = r.getStatus() == ReservationStatus.READY;
        r.setStatus(ReservationStatus.CANCELLED);
        if (wasReady && r.getCopy() != null) {
            r.getCopy().setStatus(CopyStatus.AVAILABLE);
            assignToQueue(r.getCopy());
        }
        auditService.log("RESERVATION_CANCELLED", "Reservation for “" + r.getBook().getTitle() + "” cancelled", id, by);
    }

    @Transactional(readOnly = true)
    public List<ReservationResponse> mine() {
        return mapper.toReservations(reservationRepository.findByMemberIdOrderByCreatedAtDesc(currentUser.member().getId()));
    }

    @Transactional(readOnly = true)
    @Override
    public Page<ReservationResponse> list(int page, int size, ReservationStatus status) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.ASC, "createdAt", "id"));
        Page<Reservation> rs = status == null
                ? reservationRepository.findAllBy(pageable)
                : reservationRepository.findByStatus(status, pageable);
        // Queue positions for the whole page come from one query (no N+1).
        return new PageImpl<>(mapper.toReservations(rs.getContent()), pageable, rs.getTotalElements());
    }
}
