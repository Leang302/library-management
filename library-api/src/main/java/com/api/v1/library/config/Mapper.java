package com.api.v1.library.config;

import com.api.v1.library.model.entity.AuditLog;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.entity.BorrowRequestItem;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.model.entity.Receipt;
import com.api.v1.library.model.entity.ReceiptLine;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.BookRequest;
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
import com.api.v1.library.model.update.BookUpdate;

import org.modelmapper.Converter;
import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;

/**
 * Entity -> DTO mappings. STRICT matching copies same-named fields (id, title, status...);
 * every field that comes from an association is mapped explicitly, so nothing is guessed.
 * Values that need a query or a calculation (copy counts, days late, queue position,
 * QR payloads) are filled in afterwards by ResponseMapper, in batch.
 */
@Configuration
public class Mapper {

    private static final Converter<Instant, Boolean> IS_SET = ctx -> ctx.getSource() != null;

    @Bean
    public ModelMapper modelMapper() {
        ModelMapper mm = new ModelMapper();
        mm.getConfiguration().setMatchingStrategy(MatchingStrategies.STRICT);

        // Computed in ResponseMapper (member is looked up in batch).
        mm.emptyTypeMap(User.class, UserResponse.class)
                .addMappings(m -> m.skip(UserResponse::setMember)).implicitMappings();

        mm.emptyTypeMap(Member.class, MemberResponse.class).addMappings(m -> {
            m.map(src -> src.getUser().getId(), MemberResponse::setUserId);
            m.map(src -> src.getUser().getName(), MemberResponse::setName);
            m.map(src -> src.getUser().getEmail(), MemberResponse::setEmail);
            m.skip(MemberResponse::setActiveLoans);
            m.skip(MemberResponse::setOverdueLoans);
        }).implicitMappings();

        mm.emptyTypeMap(Book.class, BookResponse.class).addMappings(m -> {
            m.skip(BookResponse::setTotalCopies);
            m.skip(BookResponse::setAvailableCopies);
            m.skip(BookResponse::setBorrowedCopies);
            m.skip(BookResponse::setReservedCopies);
        }).implicitMappings();

        mm.emptyTypeMap(BookCopy.class, CopyResponse.class).addMappings(m -> {
            m.map(src -> src.getBook().getId(), CopyResponse::setBookId);
            m.map(src -> src.getBook().getTitle(), CopyResponse::setBookTitle);
            m.skip(CopyResponse::setCurrentLoan);
        }).implicitMappings();

        mm.emptyTypeMap(Loan.class, LoanResponse.class).addMappings(m -> {
            m.map(src -> src.getRequest().getId(), LoanResponse::setRequestId);
            m.map(src -> src.getCopy().getId(), LoanResponse::setCopyId);
            m.map(src -> src.getBook().getId(), LoanResponse::setBookId);
            m.map(src -> src.getBook().getTitle(), LoanResponse::setBookTitle);
            m.map(src -> src.getBook().getAuthor(), LoanResponse::setBookAuthor);
            m.map(src -> src.getMember().getId(), LoanResponse::setMemberId);
            m.map(src -> src.getMember().getUser().getName(), LoanResponse::setMemberName);
            m.map(src -> src.getMember().getStudentId(), LoanResponse::setStudentId);
            m.skip(LoanResponse::setDaysLate);
        }).implicitMappings();

        mm.emptyTypeMap(BorrowRequestItem.class, BorrowRequestResponse.Item.class).addMappings(m -> {
            m.map(src -> src.getCopy().getId(), BorrowRequestResponse.Item::setCopyId);
            m.map(src -> src.getBook().getId(), BorrowRequestResponse.Item::setBookId);
            m.map(src -> src.getBook().getTitle(), BorrowRequestResponse.Item::setBookTitle);
            m.map(src -> src.getBook().getAuthor(), BorrowRequestResponse.Item::setBookAuthor);
            m.using(IS_SET).map(BorrowRequestItem::getVerifiedAt, BorrowRequestResponse.Item::setVerified);
        }).implicitMappings();

        mm.emptyTypeMap(BorrowRequest.class, BorrowRequestResponse.class).addMappings(m -> {
            m.map(src -> src.getMember().getId(), BorrowRequestResponse::setMemberId);
            m.map(src -> src.getMember().getUser().getName(), BorrowRequestResponse::setMemberName);
            m.map(src -> src.getMember().getStudentId(), BorrowRequestResponse::setStudentId);
            m.map(src -> src.getProcessedBy().getName(), BorrowRequestResponse::setProcessedByName);
            m.skip(BorrowRequestResponse::setQrPayload);
        }).implicitMappings();

        mm.emptyTypeMap(Reservation.class, ReservationResponse.class).addMappings(m -> {
            m.map(src -> src.getBook().getId(), ReservationResponse::setBookId);
            m.map(src -> src.getBook().getTitle(), ReservationResponse::setBookTitle);
            m.map(src -> src.getMember().getId(), ReservationResponse::setMemberId);
            m.map(src -> src.getMember().getUser().getName(), ReservationResponse::setMemberName);
            m.map(src -> src.getCopy().getId(), ReservationResponse::setCopyId);
            m.skip(ReservationResponse::setPosition);
        }).implicitMappings();

        mm.emptyTypeMap(ReceiptLine.class, ReceiptResponse.Line.class).addMappings(m -> {
            m.map(src -> src.getLoan().getCopy().getId(), ReceiptResponse.Line::setCopyId);
            m.map(src -> src.getLoan().getBook().getTitle(), ReceiptResponse.Line::setBookTitle);
            m.map(src -> src.getLoan().getDueAt(), ReceiptResponse.Line::setDueAt);
            m.map(src -> src.getLoan().getReturnedAt(), ReceiptResponse.Line::setReturnedAt);
            m.map(src -> src.getLoan().getCondition(), ReceiptResponse.Line::setCondition);
            m.skip(ReceiptResponse.Line::setDaysLate);
        }).implicitMappings();

        mm.emptyTypeMap(Receipt.class, ReceiptResponse.class).addMappings(m -> {
            m.map(src -> src.getMember().getId(), ReceiptResponse::setMemberId);
            m.map(src -> src.getMember().getUser().getName(), ReceiptResponse::setMemberName);
            m.map(src -> src.getStaff().getName(), ReceiptResponse::setStaffName);
            m.skip(ReceiptResponse::setQrPayload);
        }).implicitMappings();

        mm.createTypeMap(Notification.class, NotificationResponse.class);

        // Request -> entity. "copies" on BookRequest is a count, not the copy list.
        mm.emptyTypeMap(BookRequest.class, Book.class).addMappings(m -> {
            m.skip(Book::setId);
            m.skip(Book::setCopies);
        }).implicitMappings();
        mm.createTypeMap(BookUpdate.class, Book.class);

        mm.emptyTypeMap(AuditLog.class, AuditLogResponse.class)
                .addMappings(m -> m.map(src -> src.getUser().getName(), AuditLogResponse::setUserName)).implicitMappings();

        return mm;
    }
}
