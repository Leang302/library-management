package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Receipt;
import com.api.v1.library.model.response.ScanResolveResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.service.CheckoutService;
import com.api.v1.library.service.MemberService;
import com.api.v1.library.service.ReturnService;
import com.api.v1.library.service.ScanService;
import com.api.v1.library.util.QrCodes;

import org.springframework.http.HttpStatus;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Backs the librarian's centre Scan button: one scanner for every kind of code.
 * Works out what was scanned and which screen the app should open next.
 */
@Service
@RequiredArgsConstructor
public class ScanServiceImpl implements ScanService {

    private final BookCopyRepository copyRepository;
    private final CheckoutService checkoutService;
    private final MemberService memberService;
    private final ReturnService returnService;

    @Transactional(readOnly = true)
    public ScanResolveResponse resolve(String code) {
        QrCodes.Parsed p = QrCodes.parse(code);
        switch (p.type()) {
            case COPY -> {
                BookCopy c = copyRepository.findById(p.value())
                        .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No book copy found with ID " + p.value() + "."));
                boolean onLoan = c.getStatus() == CopyStatus.BORROWED;
                return result("COPY", c.getId(), c.getId() + " · " + c.getBook().getTitle(),
                        onLoan ? "RETURN" : "COPY_INFO");
            }
            case REQUEST, REQUEST_CODE -> {
                BorrowRequest r = checkoutService.findByScan(code);
                if (r == null) throw new CustomException(HttpStatus.NOT_FOUND, "No checkout matches this code. Ask the student to refresh their pass.");
                return result("REQUEST", String.valueOf(r.getId()),
                        "Checkout " + r.getCode() + " · " + r.getMember().getUser().getName(), "REVIEW_REQUEST");
            }
            case MEMBER, STUDENT_ID -> {
                Member m = memberService.findByScan(code);
                if (m == null) throw new CustomException(HttpStatus.NOT_FOUND, "No member matches this card.");
                return result("MEMBER", String.valueOf(m.getId()),
                        m.getUser().getName() + " · " + m.getStudentId(), "MEMBER");
            }
            case RECEIPT, RECEIPT_NO -> {
                Receipt r = returnService.findByScan(code)
                        .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No receipt matches this code. It may not be genuine."));
                return result("RECEIPT", String.valueOf(r.getId()),
                        "Receipt " + r.getNumber() + " · " + r.getMember().getUser().getName(), "RECEIPT");
            }
            default -> {
                // Last resort: a raw request token typed without its prefix.
                BorrowRequest r = checkoutService.findByScan(code);
                if (r != null) {
                    return result("REQUEST", String.valueOf(r.getId()), "Checkout " + r.getCode(), "REVIEW_REQUEST");
                }
                return result("UNKNOWN", null, "This code isn't recognised by the library.", null);
            }
        }
    }

    private static ScanResolveResponse result(String type, String id, String label, String action) {
        return ScanResolveResponse.builder().type(type).id(id).label(label).suggestedAction(action).build();
    }
}
