package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.repository.BorrowRequestRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.SettingsService;
import com.api.v1.library.service.StatusMaintenanceService;
import com.api.v1.library.util.ResponseMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Time-based status changes, run every minute: marks loans OVERDUE, expires stale
 * checkout QRs and reservation holds, and sends due-soon / overdue reminders (once each).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatusMaintenanceServiceImpl implements StatusMaintenanceService {

    private final LoanRepository loanRepository;
    private final BorrowRequestRepository requestRepository;
    private final ReservationRepository reservationRepository;
    private final SettingsService settingsService;
    private final ReservationService reservationService;
    private final NotificationService notificationService;

    @Scheduled(fixedDelayString = "${app.maintenance.interval-ms:60000}", initialDelay = 5_000)
    @Transactional
    public void refreshStatuses() {
        LibrarySettings p = settingsService.settings();
        Instant now = Instant.now();

        for (Loan loan : loanRepository.findByStatusIn(ResponseMapper.OPEN_LOAN)) {
            String title = loan.getBook().getTitle();
            if (loan.getDueAt().isBefore(now) && loan.getStatus() != LoanStatus.OVERDUE) {
                loan.setStatus(LoanStatus.OVERDUE);
                if (!loan.isOverdueNotified()) {
                    loan.setOverdueNotified(true);
                    notificationService.notify(loan.getMember().getUser(), "OVERDUE", "Book overdue",
                            "“" + title + "” is overdue. Please return it as soon as you can.", "mybooks", null);
                }
            } else if (loan.getStatus() == LoanStatus.OVERDUE && !loan.getDueAt().isBefore(now)) {
                loan.setStatus(LoanStatus.ACTIVE);
            } else if (loan.getStatus() == LoanStatus.ACTIVE && !loan.isDueSoonNotified()
                    && loan.getDueAt().isBefore(now.plus(Duration.ofDays(p.getDueSoonDays())))) {
                loan.setDueSoonNotified(true);
                notificationService.notify(loan.getMember().getUser(), "DUE_SOON", "Due soon",
                        "“" + title + "” is due on " + EligibilityService.DATE.format(loan.getDueAt()) + ".",
                        "mybooks", null);
            }
        }

        for (BorrowRequest r : requestRepository.findByStatusAndExpiresAtBefore(RequestStatus.PENDING_APPROVAL, now)) {
            r.setStatus(RequestStatus.EXPIRED);
        }

        for (Reservation r : reservationRepository.findByStatusAndHoldUntilBefore(ReservationStatus.READY, now)) {
            r.setStatus(ReservationStatus.EXPIRED);
            if (r.getCopy() != null && r.getCopy().getStatus() == CopyStatus.RESERVED) {
                r.getCopy().setStatus(CopyStatus.AVAILABLE);
                reservationService.assignToQueue(r.getCopy());
            }
        }
    }
}
