package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.response.BookResponse;
import com.api.v1.library.model.response.CartResponse;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.BookRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.service.CartService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.EligibilityService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;

import org.springframework.http.HttpStatus;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The student's borrow cart. Scanning a book only adds it here — the copy's status does not change. */
@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final BookCopyRepository copyRepository;
    private final BookRepository bookRepository;
    private final LoanRepository loanRepository;
    private final EligibilityService eligibilityService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    @Transactional
    public CartResponse view() {
        Member m = currentUser.member();
        return toResponse(m, copies(m));
    }

    /** Student scanned a book QR: validate and add it to the cart. */
    @Transactional
    public CartResponse add(String code) {
        Member m = currentUser.member();
        QrCodes.Parsed parsed = QrCodes.parse(code);
        if (parsed.type() != QrCodes.Type.COPY) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "That isn't a book label. Scan the QR code inside the book.");
        }
        BookCopy copy = copyRepository.findById(parsed.value())
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No book copy found with ID " + parsed.value() + "."));
        addCopy(m, copy);
        return toResponse(m, copies(m));
    }

    /** Book details -> "Add to cart": picks the first borrowable copy of the title. */
    @Transactional
    public CartResponse addBook(Long bookId) {
        Member m = currentUser.member();
        bookRepository.findById(bookId)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Book not found with id: " + bookId));
        BookCopy pick = copyRepository.findByBookIdOrderByIdAsc(bookId).stream()
                .filter(c -> c.getStatus() == CopyStatus.AVAILABLE || c.getStatus() == CopyStatus.RESERVED)
                .filter(c -> eligibilityService.copyCheck(c, m, null).ok())
                .findFirst()
                .orElseThrow(() -> new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "No copies are available right now."));
        addCopy(m, pick);
        return toResponse(m, copies(m));
    }

    @Transactional
    public CartResponse remove(String copyId) {
        Member m = currentUser.member();
        String id = QrCodes.normalizeCopyId(copyId);
        m.getCart().removeIf(id::equals);
        return toResponse(m, copies(m));
    }

    private void addCopy(Member m, BookCopy copy) {
        List<BookCopy> cart = copies(m);
        if (cart.stream().anyMatch(c -> c.getId().equals(copy.getId()))) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This copy is already in your cart.");
        }
        EligibilityService.CopyCheck chk = eligibilityService.copyCheck(copy, m, null);
        if (!chk.ok()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, chk.error());

        Long bookId = copy.getBook().getId();
        boolean borrowing = loanRepository.findByMemberIdAndStatusInOrderByDueAtAsc(m.getId(), ResponseMapper.OPEN_LOAN)
                .stream().anyMatch(l -> l.getBook().getId().equals(bookId));
        if (borrowing) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "You are already borrowing this title.");
        if (cart.stream().anyMatch(c -> c.getBook().getId().equals(bookId))) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Another copy of this title is already in your cart.");
        }
        var el = eligibilityService.eligibility(m, cart.size() + 1);
        if (!el.isOk()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, el.getErrors().get(0));

        m.getCart().add(copy.getId());
    }

    /** Cart copies that still exist (a deleted title silently drops out). */
    @Override
    public List<BookCopy> copies(Member m) {
        // One query for the whole cart, then restore the cart's order.
        Map<String, BookCopy> found = copyRepository.findAllById(m.getCart()).stream()
                .collect(Collectors.toMap(BookCopy::getId, Function.identity()));
        List<BookCopy> out = new ArrayList<>();
        for (String id : m.getCart()) {
            if (found.containsKey(id)) out.add(found.get(id));
        }
        if (out.size() != m.getCart().size()) {
            m.getCart().retainAll(found.keySet());
        }
        return out;
    }

    private CartResponse toResponse(Member m, List<BookCopy> copies) {
        List<BookResponse> books = mapper.toBooks(copies.stream().map(BookCopy::getBook).toList());
        List<CartResponse.Item> items = new ArrayList<>();
        for (int i = 0; i < copies.size(); i++) {
            items.add(CartResponse.Item.builder().copyId(copies.get(i).getId()).book(books.get(i)).build());
        }
        return CartResponse.builder()
                .items(items)
                .eligibility(eligibilityService.eligibility(m, copies.size()))
                .build();
    }
}
