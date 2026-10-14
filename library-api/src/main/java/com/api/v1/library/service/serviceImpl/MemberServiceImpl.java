package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.MemberStatus;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.MemberCardResponse;
import com.api.v1.library.model.response.MemberDetailResponse;
import com.api.v1.library.model.response.MemberResponse;
import com.api.v1.library.model.update.MemberStatusUpdate;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.service.MemberService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;

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
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final ReservationRepository reservationRepository;
    private final EligibilityService eligibilityService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public Page<MemberResponse> list(int page, int size, Sort.Direction direction, String q) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(direction, "user.name").and(Sort.by("id")));
        Page<Member> members = memberRepository.search(q == null ? "" : q.trim(), pageable);
        // Loan counts for the whole page come from one GROUP BY query (no N+1).
        return new PageImpl<>(mapper.toMembers(members.getContent()), pageable, members.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public MemberDetailResponse get(Long id) {
        Member m = getOrThrow(id);
        return MemberDetailResponse.builder()
                .member(mapper.toMember(m))
                .loans(mapper.toLoans(loanRepository.findByMemberIdOrderByBorrowedAtDesc(id)))
                .reservations(mapper.toReservations(reservationRepository.findByMemberIdOrderByCreatedAtDesc(id)))
                .eligibility(eligibilityService.eligibility(m, 0))
                .build();
    }

    @Transactional
    public MemberResponse updateStatus(Long id, MemberStatusUpdate request) {
        MemberStatus status = request.getStatus();
        User staff = currentUser.user();
        Member m = getOrThrow(id);
        m.setStatus(status);
        auditService.log("MEMBER_STATUS", m.getUser().getName() + " → " + status, id, staff);
        boolean active = status == MemberStatus.ACTIVE;
        notificationService.notify(m.getUser(), "SYSTEM",
                active ? "Membership reactivated" : "Membership suspended",
                active ? "You can borrow books again." : "Please contact the library desk.", null, null);
        return mapper.toMember(m);
    }

    /** Extends membership by a year from today or from the current expiry, whichever is later. */
    @Transactional
    public MemberResponse renew(Long id) {
        User staff = currentUser.user();
        Member m = getOrThrow(id);
        Instant base = m.getExpiresAt().isAfter(Instant.now()) ? m.getExpiresAt() : Instant.now();
        m.setExpiresAt(base.plus(Duration.ofDays(365)));
        auditService.log("MEMBER_RENEWED", m.getUser().getName() + " renewed until "
                + EligibilityService.DATE.format(m.getExpiresAt()), id, staff);
        return mapper.toMember(m);
    }

    /** The student's digital membership card. */
    @Transactional(readOnly = true)
    public MemberCardResponse myCard() {
        Member m = currentUser.member();
        return MemberCardResponse.builder()
                .member(mapper.toMember(m))
                .qrPayload(QrCodes.MEMBER_PREFIX + m.getMemberToken())
                .build();
    }

    /** Finds a member from a scanned card (LMS-MEM:token) or a typed student id. */
    @Transactional(readOnly = true)
    public Member findByScan(String code) {
        QrCodes.Parsed p = QrCodes.parse(code);
        return switch (p.type()) {
            case MEMBER -> memberRepository.findByMemberToken(p.value()).orElse(null);
            case STUDENT_ID -> memberRepository.findByStudentIdIgnoreCase(p.value()).orElse(null);
            default -> null;
        };
    }

    private Member getOrThrow(Long id) {
        return memberRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Member not found with id: " + id));
    }
}
