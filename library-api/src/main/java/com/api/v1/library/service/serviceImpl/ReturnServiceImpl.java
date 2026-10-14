package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ItemCondition;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.model.entity.Receipt;
import com.api.v1.library.model.entity.ReceiptLine;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.ReturnRequest;
import com.api.v1.library.model.response.ReceiptResponse;
import com.api.v1.library.model.response.ReturnPreviewResponse;
import com.api.v1.library.model.response.ReturnResultResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.NotificationRepository;
import com.api.v1.library.repository.ReceiptRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.ReturnService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;
import com.api.v1.library.util.TimeUtil;

import org.springframework.http.HttpStatus;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Check-ins. A copy can't be returned twice because its open loan is gone once RETURNED.
 * Every return produces a receipt; books returned in the same desk visit share one.
 * Late returns are tracked (days late) but cost nothing in the MVP.
 */
@Service
@RequiredArgsConstructor
public class ReturnServiceImpl implements ReturnService {

    /** Returns at the same desk visit share one receipt. */
    private static final Duration RECEIPT_MERGE = Duration.ofHours(2);

    private final BookCopyRepository copyRepository;
    private final LoanRepository loanRepository;
    private final ReceiptRepository receiptRepository;
    private final NotificationRepository notificationRepository;
    private final ReservationService reservationService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    @Transactional(readOnly = true)
    public ReturnPreviewResponse preview(String code) {
        Loan loan = openLoan(code);
        return ReturnPreviewResponse.builder()
                .copy(mapper.toCopy(loan.getCopy(), false))
                .book(mapper.toBook(loan.getBook()))
                .loan(mapper.toLoan(loan))
                .member(mapper.toMember(loan.getMember()))
                .build();
    }

    @Transactional
    public ReturnResultResponse process(ReturnRequest request) {
        User staff = currentUser.user();
        Loan loan = openLoan(request.getCode());
        copyRepository.lockAll(List.of(loan.getCopy().getId()));
        ItemCondition condition = request.getCondition() == null ? ItemCondition.GOOD : request.getCondition();
        String note = request.getNote() == null ? "" : request.getNote().trim();
        Instant now = Instant.now();

        loan.setStatus(LoanStatus.RETURNED);
        loan.setReturnedAt(now);
        loan.setReturnedTo(staff);
        loan.setCondition(condition);
        loan.setReturnNote(note);

        BookCopy copy = loan.getCopy();
        String heldFor = null;
        if (condition == ItemCondition.DAMAGED) {
            copy.setStatus(CopyStatus.MAINTENANCE);
            copy.setCondition(ItemCondition.DAMAGED);
            copy.setNote(note.isEmpty() ? "Returned damaged" : note);
        } else {
            copy.setStatus(CopyStatus.AVAILABLE);
            copy.setCondition(ItemCondition.GOOD);
            Member next = reservationService.assignToQueue(copy);
            if (next != null) heldFor = next.getUser().getName();
        }

        Receipt receipt = addToReturnReceipt(request.getReceiptId(), loan, staff);
        int late = TimeUtil.daysLate(loan.getDueAt(), now);
        auditService.log("RETURN_PROCESSED", loan.getBook().getTitle() + " (" + copy.getId() + ") returned by "
                        + loan.getMember().getUser().getName()
                        + (late > 0 ? " — " + late + "d late" : "")
                        + (condition == ItemCondition.DAMAGED ? " — damaged" : ""),
                loan.getId(), staff);

        return ReturnResultResponse.builder()
                .loan(mapper.toLoan(loan))
                .copyStatus(copy.getStatus())
                .heldForName(heldFor)
                .receipt(mapper.toReceipt(receipt))
                .build();
    }

    @Transactional(readOnly = true)
    public List<ReceiptResponse> mine() {
        return mapper.toReceipts(receiptRepository.findByMemberIdOrderByUpdatedAtDesc(currentUser.member().getId()));
    }

    /** Staff scan a receipt QR (or type its number) to check it is genuine. */
    @Transactional(readOnly = true)
    public ReceiptResponse verify(String code) {
        return mapper.toReceipt(findByScan(code)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No receipt matches this code. It may not be genuine.")));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<Receipt> findByScan(String code) {
        QrCodes.Parsed p = QrCodes.parse(code);
        return switch (p.type()) {
            case RECEIPT -> receiptRepository.findByToken(p.value());
            case RECEIPT_NO -> receiptRepository.findByNumberIgnoreCase(p.value());
            default -> java.util.Optional.empty();
        };
    }

    private Loan openLoan(String code) {
        String copyId = QrCodes.normalizeCopyId(code);
        BookCopy copy = copyRepository.findById(copyId)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No book copy found with ID " + copyId + "."));
        return loanRepository.findFirstByCopyIdAndStatusIn(copyId, ResponseMapper.OPEN_LOAN)
                .orElseThrow(() -> new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, copy.getStatus() == CopyStatus.AVAILABLE
                        ? "This copy is not on loan — it may already have been returned."
                        : "This copy has no active loan (status: " + copy.getStatus() + ")."));
    }

    /** Adds a returned book to the open receipt for this visit, or starts a new one. */
    private Receipt addToReturnReceipt(Long receiptId, Loan loan, User staff) {
        Member member = loan.getMember();
        Receipt r = receiptId == null ? null : receiptRepository.findById(receiptId).orElse(null);
        boolean reusable = r != null
                && "RETURN".equals(r.getType())
                && r.getMember().getId().equals(member.getId())
                && r.getCreatedAt() != null
                && Duration.between(r.getCreatedAt(), Instant.now()).compareTo(RECEIPT_MERGE) < 0;
        if (!reusable) {
            r = receiptRepository.save(Receipt.builder()
                    .type("RETURN")
                    .number(uniqueNumber())
                    .token(QrCodes.randomToken(20))
                    .member(member)
                    .staff(staff)
                    .build());
        }
        r.getLines().add(ReceiptLine.builder().receipt(r).loan(loan).build());
        r.setUpdatedAt(Instant.now());

        // One notification per receipt, kept up to date as books are added.
        int n = r.getLines().size();
        String titles = r.getLines().stream().map(l -> "“" + l.getLoan().getBook().getTitle() + "”")
                .collect(Collectors.joining(", "));
        String title = n > 1 ? "Return confirmed · " + n + " books" : "Return confirmed";
        String body = titles + (n > 1 ? " were" : " was") + " checked in. Receipt " + r.getNumber() + ".";
        Notification existing = r.getNotificationId() == null ? null
                : notificationRepository.findById(r.getNotificationId()).orElse(null);
        if (existing != null) {
            existing.setTitle(title);
            existing.setBody(body);
            existing.setRead(false);
            existing.setCreatedAt(Instant.now());
            notificationService.push(existing);
        } else {
            Notification created = notificationService.notify(member.getUser(), "RETURN_CONFIRMED", title, body, "receipt", r.getId());
            r.setNotificationId(created.getId());
        }
        return receiptRepository.save(r);
    }

    private String uniqueNumber() {
        String number;
        do {
            number = "RT-" + QrCodes.randomToken(6);
        } while (receiptRepository.existsByNumber(number));
        return number;
    }
}
