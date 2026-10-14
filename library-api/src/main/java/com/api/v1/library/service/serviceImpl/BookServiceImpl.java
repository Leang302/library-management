package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.BookSortEnum;
import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ItemCondition;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.BookRequest;
import com.api.v1.library.model.response.BookDetailResponse;
import com.api.v1.library.model.response.BookResponse;
import com.api.v1.library.model.response.CopyResponse;
import com.api.v1.library.model.update.BookUpdate;
import com.api.v1.library.model.update.CopyStatusUpdate;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.BookRepository;
import com.api.v1.library.repository.BorrowRequestItemRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.BookService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.SettingsService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class BookServiceImpl implements BookService {

    private final BookRepository bookRepository;
    private final BookCopyRepository copyRepository;
    private final LoanRepository loanRepository;
    private final BorrowRequestItemRepository requestItemRepository;
    private final ReservationRepository reservationRepository;
    private final MemberRepository memberRepository;
    private final SettingsService settingsService;
    private final ReservationService reservationService;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;
    private final ModelMapper modelMapper;

    /* ---------------- catalogue ---------------- */

    @Override
    @Transactional(readOnly = true)
    public Page<BookResponse> list(int page, int size, BookSortEnum sort, Sort.Direction direction,
                                   String q, String category, boolean availableOnly, boolean includeArchived) {
        boolean staff = currentUser.user().getRole() != Role.STUDENT;
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(direction, sort.name()).and(Sort.by("id")));
        Page<Book> books = bookRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!(includeArchived && staff)) predicates.add(cb.isFalse(root.get("archived")));
            if (StringUtils.hasText(category)) predicates.add(cb.equal(root.get("category"), category.trim()));
            if (StringUtils.hasText(q)) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("author")), like),
                        cb.like(root.get("isbn"), like)));
            }
            if (availableOnly) {
                Subquery<String> available = query.subquery(String.class);
                Root<BookCopy> copy = available.from(BookCopy.class);
                available.select(copy.get("id")).where(
                        cb.equal(copy.get("book"), root),
                        cb.equal(copy.get("status"), CopyStatus.AVAILABLE));
                predicates.add(cb.exists(available));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable);
        // Availability for the whole page comes from one GROUP BY query (no N+1).
        return new PageImpl<>(mapper.toBooks(books.getContent()), pageable, books.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public BookDetailResponse get(Long id) {
        User user = currentUser.user();
        boolean staff = user.getRole() != Role.STUDENT;
        Book book = bookRepository.findById(id)
                .filter(b -> staff || !b.isArchived())
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Book not found with id: " + id));
        Reservation mine = memberRepository.findByUserId(user.getId())
                .flatMap(m -> reservationRepository.findFirstByMemberIdAndBookIdAndStatusIn(
                        m.getId(), id, ReservationService.LIVE))
                .orElse(null);
        return BookDetailResponse.builder()
                .book(mapper.toBook(book))
                .copies(mapper.toCopies(book.getCopies(), staff))
                .queueLength(reservationRepository
                        .findByBookIdAndStatusOrderByCreatedAtAscIdAsc(id, ReservationStatus.WAITING).size())
                .myReservation(mine == null ? null : mapper.toReservation(mine))
                .build();
    }

    @Transactional(readOnly = true)
    public List<String> categories() {
        return bookRepository.findCategories();
    }

    /* ---------------- management (staff) ---------------- */

    @Transactional
    public BookResponse create(BookRequest request) {
        User staff = currentUser.user();
        String isbn = validIsbn(request.getIsbn());
        if (bookRepository.existsByIsbn(isbn)) throw new CustomException(HttpStatus.CONFLICT, "A book with this ISBN already exists");
        int count = request.getCopies() == null ? 1 : request.getCopies();

        Book book = modelMapper.map(request, Book.class);
        book.setIsbn(isbn);
        applyDefaults(book);
        book = bookRepository.save(book);
        List<BookCopy> copies = createCopies(book, count);
        book.getCopies().addAll(copies);
        auditService.log("BOOK_CREATED", "Added “" + book.getTitle() + "” with "
                + count + (count == 1 ? " copy" : " copies"), book.getId(), staff);
        return mapper.toBook(book);
    }

    @Transactional
    public BookResponse update(Long id, BookUpdate request) {
        User staff = currentUser.user();
        Book book = getOrThrow(id);
        String isbn = validIsbn(request.getIsbn());
        if (bookRepository.existsByIsbnAndIdNot(isbn, id)) throw new CustomException(HttpStatus.CONFLICT, "A book with this ISBN already exists");
        modelMapper.map(request, book);
        book.setIsbn(isbn);
        applyDefaults(book);
        auditService.log("BOOK_UPDATED", "Edited “" + book.getTitle() + "”", id, staff);
        return mapper.toBook(book);
    }

    /** Each physical copy gets its own unique, QR-encodable identifier. */
    @Transactional
    public List<CopyResponse> addCopies(Long id, int count) {
        User staff = currentUser.user();
        Book book = getOrThrow(id);
        List<BookCopy> copies = createCopies(book, count);
        book.getCopies().addAll(copies);
        auditService.log("COPIES_ADDED", count + (count == 1 ? " copy" : " copies") + " added to “"
                + book.getTitle() + "”", id, staff);
        return mapper.toCopies(copies, false);
    }

    @Transactional
    public BookResponse setArchived(Long id, boolean archived) {
        User staff = currentUser.user();
        Book book = getOrThrow(id);
        book.setArchived(archived);
        auditService.log(archived ? "BOOK_ARCHIVED" : "BOOK_RESTORED", "“" + book.getTitle() + "” "
                + (archived ? "archived" : "restored to catalogue"), id, staff);
        return mapper.toBook(book);
    }

    /** A title may only be deleted if it has never circulated. Otherwise archive it. */
    @Transactional
    public void delete(Long id) {
        User staff = currentUser.user();
        Book book = getOrThrow(id);
        if (loanRepository.existsByBookId(id)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This title has borrowing history. Archive it instead to keep records intact.");
        }
        if (requestItemRepository.existsByBookId(id)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This title appears in checkout requests. Archive it instead.");
        }
        if (reservationRepository.existsByBookIdAndStatusIn(id, ReservationService.LIVE)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Members have active reservations for this title.");
        }
        List<String> copyIds = book.getCopies().stream().map(BookCopy::getId).toList();
        for (Member m : memberRepository.findAll()) {
            m.getCart().removeIf(copyIds::contains);
        }
        copyRepository.deleteAll(book.getCopies());
        bookRepository.delete(book);
        auditService.log("BOOK_DELETED", "Deleted “" + book.getTitle() + "”", id, staff);
    }

    /* ---------------- copies (staff) ---------------- */

    @Transactional(readOnly = true)
    public CopyResponse getCopy(String code) {
        return mapper.toCopy(copyOrThrow(code), true);
    }

    /** Manual copy status changes: lost / maintenance / back on the shelf. */
    @Transactional
    public CopyResponse updateCopyStatus(String code, CopyStatusUpdate request) {
        CopyStatus status = request.getStatus();
        String note = request.getNote();
        User staff = currentUser.user();
        BookCopy c = copyOrThrow(code);
        if (c.getStatus() == CopyStatus.BORROWED) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This copy is on loan. Process the return first.");
        }
        if (status != CopyStatus.AVAILABLE && status != CopyStatus.MAINTENANCE && status != CopyStatus.LOST) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Unsupported status.");
        }
        if (c.getStatus() == CopyStatus.RESERVED) {
            // Put the reservation back in the queue; it will get the next copy.
            reservationRepository.findFirstByCopyIdAndStatus(c.getId(), ReservationStatus.READY).ifPresent(r -> {
                r.setStatus(ReservationStatus.WAITING);
                r.setCopy(null);
                r.setReadyAt(null);
                r.setHoldUntil(null);
            });
        }
        String n = note == null ? "" : note.trim();
        c.setStatus(status);
        c.setNote(n);
        if (n.toLowerCase(Locale.ROOT).contains("damag")) c.setCondition(ItemCondition.DAMAGED);
        else if (status == CopyStatus.AVAILABLE) c.setCondition(ItemCondition.GOOD);
        if (status == CopyStatus.AVAILABLE) reservationService.assignToQueue(c);
        auditService.log("COPY_STATUS", c.getId() + " → " + status + (n.isEmpty() ? "" : " (" + n + ")"), c.getId(), staff);
        return mapper.toCopy(c, true);
    }

    /* ---------------- helpers ---------------- */

    private List<BookCopy> createCopies(Book book, int count) {
        List<BookCopy> copies = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            BookCopy c = copyRepository.save(BookCopy.builder()
                    .id(settingsService.nextCopyId())
                    .book(book)
                    .status(CopyStatus.AVAILABLE)
                    .condition(ItemCondition.GOOD)
                    .note("")
                    .build());
            copies.add(c);
            reservationService.assignToQueue(c);
        }
        return copies;
    }

    /** Trims text and fills defaults after ModelMapper copied the request onto the entity. */
    private void applyDefaults(Book book) {
        book.setTitle(book.getTitle().trim());
        book.setAuthor(book.getAuthor().trim());
        book.setPublisher(trim(book.getPublisher()));
        book.setCategory(book.getCategory().trim());
        book.setLanguage(book.getLanguage() == null || book.getLanguage().isBlank() ? "English" : book.getLanguage().trim());
        book.setDescription(trim(book.getDescription()));
        book.setShelf(book.getShelf() == null || book.getShelf().isBlank() ? "Unshelved" : book.getShelf().trim());
    }

    /** Normalises an ISBN (drops spaces/dashes) and verifies its checksum. */
    static String validIsbn(String raw) {
        String isbn = raw == null ? "" : raw.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (!isbn.matches("^(\\d{9}[\\dX]|\\d{13})$")) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Enter a 10- or 13-digit ISBN");
        if (!checksumOk(isbn)) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "ISBN checksum is invalid — check the digits");
        return isbn;
    }

    private static boolean checksumOk(String isbn) {
        int sum = 0;
        if (isbn.length() == 10) {
            for (int i = 0; i < 10; i++) {
                char ch = isbn.charAt(i);
                int v = ch == 'X' ? 10 : ch - '0';
                sum += v * (10 - i);
            }
            return sum % 11 == 0;
        }
        for (int i = 0; i < 13; i++) {
            sum += (isbn.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
        }
        return sum % 10 == 0;
    }

    private BookCopy copyOrThrow(String code) {
        String id = QrCodes.normalizeCopyId(code);
        return copyRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "No book copy found with ID " + id + "."));
    }

    private Book getOrThrow(Long id) {
        return bookRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Book not found with id: " + id));
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

}
