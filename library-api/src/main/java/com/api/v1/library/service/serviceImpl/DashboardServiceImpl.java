package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.response.LibrarianDashboardResponse;
import com.api.v1.library.model.response.ReportsResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.BookRepository;
import com.api.v1.library.repository.BorrowRequestRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.service.DashboardService;
import com.api.v1.library.util.ResponseMapper;
import com.api.v1.library.util.TimeUtil;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Statistics, always computed from stored data. */
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final LoanRepository loanRepository;
    private final BorrowRequestRepository requestRepository;
    private final BookCopyRepository copyRepository;
    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final ResponseMapper mapper;

    @Transactional(readOnly = true)
    public LibrarianDashboardResponse librarian() {
        Instant now = Instant.now();
        Instant weekAgo = TimeUtil.startOfDay(now.minus(Duration.ofDays(6)));
        LocalDate today = TimeUtil.localDate(now);
        List<Loan> borrowedThisWeek = loanRepository.findByBorrowedAtAfter(weekAgo);
        List<Loan> returnedThisWeek = loanRepository.findByReturnedAtAfter(weekAgo);

        List<LibrarianDashboardResponse.DayStat> last7 = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            last7.add(LibrarianDashboardResponse.DayStat.builder()
                    .label(d.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .borrowed(borrowedThisWeek.stream().filter(l -> TimeUtil.localDate(l.getBorrowedAt()).equals(d)).count())
                    .returned(returnedThisWeek.stream().filter(l -> TimeUtil.localDate(l.getReturnedAt()).equals(d)).count())
                    .build());
        }

        List<Loan> open = loanRepository.findByStatusIn(ResponseMapper.OPEN_LOAN);
        return LibrarianDashboardResponse.builder()
                .borrowedToday(last7.get(6).getBorrowed())
                .returnedToday(last7.get(6).getReturned())
                .pending(requestRepository.countByStatus(RequestStatus.PENDING_APPROVAL))
                .overdue(open.stream().filter(l -> l.getStatus() == LoanStatus.OVERDUE).count())
                .activeMembers(memberRepository.countValid(now))
                .availableCopies(copyRepository.countByStatus(CopyStatus.AVAILABLE))
                .dueToday(mapper.toLoans(open.stream()
                        .filter(l -> l.getStatus() == LoanStatus.ACTIVE && TimeUtil.localDate(l.getDueAt()).equals(today))
                        .toList()))
                .pendingRequests(mapper.toRequests(requestRepository.findByStatusOrderByRequestedAtAsc(RequestStatus.PENDING_APPROVAL).stream()
                        .filter(r -> r.getExpiresAt().isAfter(now))
                        .toList()))
                .last7(last7)
                .build();
    }

    @Transactional(readOnly = true)
    public ReportsResponse reports(int days) {
        int range = Math.max(1, Math.min(days, 365));
        Instant from = TimeUtil.startOfDay(Instant.now().minus(Duration.ofDays(range - 1L)));
        List<Loan> borrowed = loanRepository.findByBorrowedAtAfter(from);

        Map<Book, Long> byBook = borrowed.stream().collect(Collectors.groupingBy(Loan::getBook, Collectors.counting()));
        List<ReportsResponse.TopBook> top = byBook.entrySet().stream()
                .sorted(Map.Entry.<Book, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> ReportsResponse.TopBook.builder()
                        .bookId(e.getKey().getId()).title(e.getKey().getTitle()).count(e.getValue()).build())
                .toList();
        List<ReportsResponse.CategoryCount> categories = borrowed.stream()
                .collect(Collectors.groupingBy(l -> l.getBook().getCategory(), Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> ReportsResponse.CategoryCount.builder().name(e.getKey()).count(e.getValue()).build())
                .toList();

        return ReportsResponse.builder()
                .days(range)
                .borrowed(borrowed.size())
                .returned(loanRepository.findByReturnedAtAfter(from).size())
                .overdue(loanRepository.countByStatus(LoanStatus.OVERDUE))
                .lost(copyRepository.countByStatus(CopyStatus.LOST))
                .totalCopies(copyRepository.countByStatusNot(CopyStatus.LOST))
                .totalTitles(bookRepository.countByArchivedFalse())
                .activeMembers(memberRepository.countValid(Instant.now()))
                .newMembers(memberRepository.countByJoinedAtAfter(from))
                .topBooks(top)
                .categories(categories)
                .build();
    }
}
