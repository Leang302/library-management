package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.MemberStatus;
import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.response.CheckResponse;
import com.api.v1.library.model.response.EligibilityResponse;
import com.api.v1.library.repository.BorrowRequestItemRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.service.SettingsService;
import com.api.v1.library.util.ResponseMapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Single source of truth for "can this member borrow?" and "is this copy borrowable?".
 * Used by the cart, by checkout-request creation AND again by librarian approval.
 */
@Service
@RequiredArgsConstructor
public class EligibilityServiceImpl implements EligibilityService {

    private final LoanRepository loanRepository;
    private final ReservationRepository reservationRepository;
    private final BorrowRequestItemRepository requestItemRepository;
    private final SettingsService settingsService;

    public boolean isMembershipValid(Member m) {
        return m != null && m.getStatus() == MemberStatus.ACTIVE && m.getExpiresAt().isAfter(Instant.now());
    }

    /** Can this member borrow {@code extra} more books right now? */
    public EligibilityResponse eligibility(Member m, int extra) {
        LibrarySettings p = settingsService.settings();
        List<CheckResponse> checks = new ArrayList<>();
        List<Loan> open = loanRepository.findByMemberIdAndStatusInOrderByDueAtAsc(m.getId(), ResponseMapper.OPEN_LOAN);
        long overdue = open.stream().filter(l -> l.getStatus() == LoanStatus.OVERDUE).count();

        boolean active = m.getStatus() == MemberStatus.ACTIVE;
        checks.add(EligibilityService.check("status", "Membership active", active,
                active ? "Member in good standing" : "Membership is " + m.getStatus().name().toLowerCase(Locale.ROOT)));

        boolean expired = !m.getExpiresAt().isAfter(Instant.now());
        checks.add(EligibilityService.check("expiry", "Membership not expired", !expired,
                (expired ? "Expired on " : "Valid until ") + DATE.format(m.getExpiresAt())));

        if (p.isBlockOnOverdue()) {
            checks.add(EligibilityService.check("overdue", "No overdue books", overdue == 0,
                    overdue == 0 ? "No overdue loans" : EligibilityService.plural(overdue, "overdue book") + " must be returned first"));
        }

        int total = open.size() + extra;
        checks.add(EligibilityService.check("limit", "Borrowing limit", total <= p.getMaxBorrow(),
                open.size() + " borrowed + " + extra + " requested = " + total + " of " + p.getMaxBorrow()));

        List<String> errors = checks.stream().filter(c -> !c.isOk()).map(CheckResponse::getDetail).toList();
        return EligibilityResponse.builder()
                .ok(errors.isEmpty())
                .checks(checks)
                .errors(errors)
                .activeCount(open.size())
                .overdueCount((int) overdue)
                .remaining(Math.max(0, p.getMaxBorrow() - open.size()))
                .build();
    }

    /** Is this physical copy borrowable by this member right now? */
    public CopyCheck copyCheck(BookCopy c, Member m, Long ignoreRequestId) {
        if (c.getBook().isArchived()) return CopyCheck.fail("This title has been withdrawn from circulation.");

        if (c.getStatus() == CopyStatus.RESERVED) {
            Reservation r = reservationRepository.findFirstByCopyIdAndStatus(c.getId(), ReservationStatus.READY).orElse(null);
            if (r != null && r.getMember().getId().equals(m.getId())) return CopyCheck.pass(r);
            return CopyCheck.fail("This copy is on hold for another member's reservation.");
        }
        if (c.getStatus() != CopyStatus.AVAILABLE) {
            return CopyCheck.fail(switch (c.getStatus()) {
                case BORROWED -> "This copy is currently borrowed.";
                case MAINTENANCE -> "This copy is under maintenance.";
                case LOST -> "This copy is marked as lost.";
                default -> "This copy is not available.";
            });
        }
        // Soft lock: the copy is already in another member's pending checkout.
        boolean heldByOther = requestItemRepository
                .findByCopyIdAndRequestStatus(c.getId(), RequestStatus.PENDING_APPROVAL).stream()
                .anyMatch(i -> !i.getRequest().getId().equals(ignoreRequestId)
                        && !i.getRequest().getMember().getId().equals(m.getId()));
        if (heldByOther) return CopyCheck.fail("This copy is held in another member's pending checkout.");
        return CopyCheck.pass(null);
    }

}
