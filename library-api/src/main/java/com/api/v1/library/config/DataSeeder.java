package com.api.v1.library.config;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ItemCondition;
import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.common.enumerates.MemberStatus;
import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.model.entity.Book;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.entity.Loan;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.repository.BookCopyRepository;
import com.api.v1.library.repository.BookRepository;
import com.api.v1.library.repository.LibrarySettingsRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.ReservationRepository;
import com.api.v1.library.repository.UserRepository;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.TimeUtil;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Demo dataset, created only when the database has no users. Dates are relative to
 * "now" so due dates, overdue items and dashboard charts always look current.
 * A fixed random seed keeps the history identical across resets.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements CommandLineRunner {

    // title, author, isbn, publisher, year, category, copies, shelf, pages
    private static final Object[][] BOOKS = {
            {"Atomic Habits", "James Clear", "9780735211292", "Avery", 2018, "Self-Help", 3, "A-01", 320},
            {"Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "9780062316097", "Harper", 2015, "History", 2, "H-04", 464},
            {"The Pragmatic Programmer", "David Thomas & Andrew Hunt", "9780135957059", "Addison-Wesley", 2019, "Technology", 2, "T-02", 352},
            {"Clean Code", "Robert C. Martin", "9780132350884", "Prentice Hall", 2008, "Technology", 2, "T-02", 464},
            {"Educated", "Tara Westover", "9780399590504", "Random House", 2018, "Biography", 2, "B-01", 352},
            {"The Midnight Library", "Matt Haig", "9780525559474", "Viking", 2020, "Fiction", 3, "F-07", 304},
            {"Project Hail Mary", "Andy Weir", "9780593135204", "Ballantine Books", 2021, "Science Fiction", 2, "S-03", 496},
            {"Dune", "Frank Herbert", "9780441172719", "Ace", 1990, "Science Fiction", 2, "S-01", 896},
            {"1984", "George Orwell", "9780451524935", "Signet Classics", 1961, "Fiction", 2, "F-02", 328},
            {"To Kill a Mockingbird", "Harper Lee", "9780061120084", "Harper Perennial", 2006, "Fiction", 2, "F-03", 336},
            {"Thinking, Fast and Slow", "Daniel Kahneman", "9780374533557", "Farrar, Straus and Giroux", 2013, "Psychology", 2, "P-01", 512},
            {"A Brief History of Time", "Stephen Hawking", "9780553380163", "Bantam", 1998, "Science", 2, "C-02", 212},
            {"The Great Gatsby", "F. Scott Fitzgerald", "9780743273565", "Scribner", 2004, "Fiction", 2, "F-04", 180},
            {"Deep Work", "Cal Newport", "9781455586691", "Grand Central Publishing", 2016, "Self-Help", 2, "A-02", 304},
            {"The Psychology of Money", "Morgan Housel", "9780857197689", "Harriman House", 2020, "Business", 2, "E-03", 256},
            {"Introduction to Algorithms", "Cormen, Leiserson, Rivest & Stein", "9780262033848", "MIT Press", 2009, "Technology", 2, "T-05", 1312},
            {"The Lean Startup", "Eric Ries", "9780307887894", "Crown Business", 2011, "Business", 2, "E-01", 336},
            {"Becoming", "Michelle Obama", "9781524763138", "Crown", 2018, "Biography", 2, "B-02", 448},
            {"The Alchemist", "Paulo Coelho", "9780062315007", "HarperOne", 2014, "Fiction", 2, "F-01", 208},
            {"Cosmos", "Carl Sagan", "9780345539434", "Ballantine Books", 2013, "Science", 2, "C-01", 432},
            {"The Hobbit", "J.R.R. Tolkien", "9780547928227", "Mariner Books", 2012, "Fantasy", 2, "D-01", 300},
            {"Harry Potter and the Sorcerer's Stone", "J.K. Rowling", "9780590353427", "Scholastic", 1998, "Fantasy", 3, "D-02", 309},
            {"The Selfish Gene", "Richard Dawkins", "9780198788607", "Oxford University Press", 2016, "Science", 2, "C-03", 544},
            {"Man's Search for Meaning", "Viktor E. Frankl", "9780807014271", "Beacon Press", 2006, "Psychology", 1, "P-02", 184},
            {"Zero to One", "Peter Thiel", "9780804139298", "Crown Business", 2014, "Business", 2, "E-02", 224},
    };

    // name, email, program, year, joinedDaysAgo, membership expires in (days), status
    private static final Object[][] STUDENTS = {
            {"Alex Morgan", "student@library.com", "Computer Science", 3, 420, 310, "ACTIVE"},
            {"Priya Sharma", "priya.sharma@uni.edu", "Biology", 2, 300, 430, "ACTIVE"},
            {"Marcus Johnson", "marcus.j@uni.edu", "History", 4, 520, 210, "ACTIVE"},
            {"Emma Wilson", "emma.wilson@uni.edu", "Psychology", 1, 25, 700, "ACTIVE"},
            {"Noah Kim", "noah.kim@uni.edu", "Physics", 3, 200, 530, "ACTIVE"},
            {"Liam Garcia", "liam.garcia@uni.edu", "Business Administration", 2, 150, 580, "ACTIVE"},
            {"Olivia Brown", "olivia.b@uni.edu", "English Literature", 4, 600, 130, "ACTIVE"},
            {"Ethan Davis", "ethan.davis@uni.edu", "Mechanical Engineering", 1, 3, 725, "ACTIVE"},
            {"Sofia Rossi", "sofia.rossi@uni.edu", "Architecture", 2, 90, 640, "SUSPENDED"},
            {"James Lee", "james.lee@uni.edu", "Mathematics", 4, 380, -10, "ACTIVE"},
    };

    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final BookRepository bookRepository;
    private final BookCopyRepository copyRepository;
    private final LoanRepository loanRepository;
    private final ReservationRepository reservationRepository;
    private final LibrarySettingsRepository settingsRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) return;
        log.info("Empty database: seeding Greenleaf Library demo data...");
        Instant now = Instant.now();
        Random rnd = new Random(20241014);

        LibrarySettings settings = settingsRepository.save(LibrarySettings.builder().id(LibrarySettings.SINGLETON_ID).build());

        User lib1 = staff("Sarah Chen", "librarian@library.com", "library123", Role.LIBRARIAN, "Circulation Librarian");
        User lib2 = staff("David Okafor", "d.okafor@library.com", "library123", Role.LIBRARIAN, "Reference Librarian");

        String studentHash = passwordEncoder.encode("student123");
        List<Member> members = new ArrayList<>();
        for (int i = 0; i < STUDENTS.length; i++) {
            Object[] s = STUDENTS[i];
            User u = userRepository.save(User.builder()
                    .name((String) s[0]).email((String) s[1]).passwordHash(studentHash)
                    .role(Role.STUDENT).phone("+1 (555) 020-" + (3000 + i)).active(true).build());
            members.add(memberRepository.save(Member.builder()
                    .user(u)
                    .studentId("STU-" + (10231 + i))
                    .program((String) s[2])
                    .year((Integer) s[3])
                    .memberToken(QrCodes.randomToken(20))
                    .status(MemberStatus.valueOf((String) s[6]))
                    .joinedAt(daysAgo(now, (Integer) s[4]))
                    .expiresAt(now.plus(Duration.ofDays((Integer) s[5])))
                    .build()));
        }

        long seq = 0;
        List<Book> books = new ArrayList<>();
        List<List<BookCopy>> copies = new ArrayList<>();
        for (Object[] b : BOOKS) {
            Book book = bookRepository.save(Book.builder()
                    .title((String) b[0]).author((String) b[1]).isbn((String) b[2]).publisher((String) b[3])
                    .year((Integer) b[4]).category((String) b[5]).shelf((String) b[7]).pages((Integer) b[8])
                    .language("English")
                    .description("A well-loved title in our " + b[5] + " collection.")
                    .build());
            List<BookCopy> list = new ArrayList<>();
            for (int c = 0; c < (Integer) b[6]; c++) {
                list.add(copyRepository.save(BookCopy.builder()
                        .id(QrCodes.copyIdFor(++seq)).book(book)
                        .status(CopyStatus.AVAILABLE).condition(ItemCondition.GOOD).note("").build()));
            }
            books.add(book);
            copies.add(list);
        }
        settings.setCopySeq(seq);

        // History: ~60 returned loans over the last 90 days, for charts and "History" tabs.
        for (int i = 0; i < 60; i++) {
            int bi = rnd.nextInt(books.size());
            Member m = members.get(rnd.nextInt(8));
            int borrowedAgo = 15 + rnd.nextInt(75);
            int keptDays = 3 + rnd.nextInt(16); // some come back late
            Instant borrowed = daysAgo(now, borrowedAgo).minus(Duration.ofHours(rnd.nextInt(8)));
            Instant due = TimeUtil.endOfDay(borrowed.plus(Duration.ofDays(14)));
            Instant returned = borrowed.plus(Duration.ofDays(keptDays));
            loanRepository.save(Loan.builder()
                    .member(m).copy(copies.get(bi).get(0)).book(books.get(bi))
                    .borrowedAt(borrowed).dueAt(due).returnedAt(returned).status(LoanStatus.RETURNED)
                    .approvedBy(lib1).returnedTo(lib1).condition(ItemCondition.GOOD)
                    .dueSoonNotified(true).overdueNotified(returned.isAfter(due))
                    .build());
        }

        // Current loans: Alex has two (one due soon), Marcus has an overdue one, a few others.
        lend(members.get(0), copies.get(0).get(0), now, 10, lib1);   // Atomic Habits, due in 4 days
        lend(members.get(0), copies.get(7).get(0), now, 3, lib1);    // Dune
        lend(members.get(2), copies.get(1).get(0), now, 20, lib1);   // Sapiens — overdue
        lend(members.get(1), copies.get(6).get(0), now, 5, lib1);    // Project Hail Mary
        lend(members.get(3), copies.get(6).get(1), now, 2, lib1);    // Project Hail Mary (last copy)
        lend(members.get(4), copies.get(23).get(0), now, 8, lib1);   // Man's Search for Meaning (only copy)
        lend(members.get(5), copies.get(10).get(0), now, 1, lib2);  // Thinking, Fast and Slow

        // Project Hail Mary is fully borrowed: Alex is first in the queue.
        reservationRepository.save(Reservation.builder()
                .member(members.get(0)).book(books.get(6)).status(ReservationStatus.WAITING).build());

        log.info("Seeded {} users, {} titles, {} copies.", userRepository.count(), books.size(), seq);
    }

    private User staff(String name, String email, String password, Role role, String title) {
        return userRepository.save(User.builder()
                .name(name).email(email).passwordHash(passwordEncoder.encode(password))
                .role(role).title(title).phone("+1 (555) 010-1000").active(true).build());
    }

    private void lend(Member m, BookCopy copy, Instant now, int borrowedDaysAgo, User staff) {
        Instant borrowed = daysAgo(now, borrowedDaysAgo);
        Instant due = TimeUtil.endOfDay(borrowed.plus(Duration.ofDays(14)));
        copy.setStatus(CopyStatus.BORROWED);
        loanRepository.save(Loan.builder()
                .member(m).copy(copy).book(copy.getBook())
                .borrowedAt(borrowed).dueAt(due)
                .status(due.isBefore(now) ? LoanStatus.OVERDUE : LoanStatus.ACTIVE)
                .approvedBy(staff)
                .build());
    }

    private static Instant daysAgo(Instant now, int days) {
        return now.minus(Duration.ofDays(days));
    }
}
