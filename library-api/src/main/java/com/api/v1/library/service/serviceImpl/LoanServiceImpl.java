package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.response.LoanResponse;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.LoanService;
import com.api.v1.library.util.ResponseMapper;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class LoanServiceImpl implements LoanService {

    private final LoanRepository loanRepository;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    /** Staff transaction list. status: ALL, ACTIVE (= open, incl. overdue), OVERDUE or RETURNED. */
    @Transactional(readOnly = true)
    @Override
    public Page<LoanResponse> list(int page, int size, Sort.Direction direction, String status, String q) {
        List<LoanStatus> statuses = switch (status == null ? "ALL" : status.toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> ResponseMapper.OPEN_LOAN;
            case "OVERDUE" -> List.of(LoanStatus.OVERDUE);
            case "RETURNED" -> List.of(LoanStatus.RETURNED);
            default -> List.of(LoanStatus.values());
        };
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(direction, "borrowedAt", "id"));
        Page<Loan> loans = loanRepository.search(statuses, q == null ? "" : q.trim(), pageable);
        return new PageImpl<>(mapper.toLoans(loans.getContent()), pageable, loans.getTotalElements());
    }

    /** The student's loans. scope=current (on loan now, soonest due first) or history (returned). */
    @Transactional(readOnly = true)
    public List<LoanResponse> mine(String scope) {
        Member m = currentUser.member();
        var loans = "history".equalsIgnoreCase(scope)
                ? loanRepository.findByMemberIdAndStatusOrderByReturnedAtDesc(m.getId(), LoanStatus.RETURNED)
                : loanRepository.findByMemberIdAndStatusInOrderByDueAtAsc(m.getId(), ResponseMapper.OPEN_LOAN);
        return mapper.toLoans(loans);
    }
}
