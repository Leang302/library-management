package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.MemberStatus;
import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.UserCreateRequest;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.model.update.UserUpdate;
import com.api.v1.library.repository.AuditLogRepository;
import com.api.v1.library.repository.DeviceTokenRepository;
import com.api.v1.library.repository.LoanRepository;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.NotificationRepository;
import com.api.v1.library.repository.UserRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.UserService;
import com.api.v1.library.util.QrCodes;
import com.api.v1.library.util.ResponseMapper;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/** Account management (librarians manage students and other librarians). */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> list(int page, int size, Sort.Direction direction, Role role, String q) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(direction, "name").and(Sort.by("id")));
        Page<User> users = userRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (StringUtils.hasText(q)) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(root.get("email")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable);
        // Member records for the whole page come from one query (no N+1).
        return new PageImpl<>(mapper.toUsers(users.getContent()), pageable, users.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse get(Long id) {
        return mapper.toUser(getOrThrow(id));
    }

    /**
     * Creates an account. A student is only registered against a physical student ID card:
     * its number must be given and must be unique.
     */
    @Transactional
    public UserResponse create(UserCreateRequest r) {
        User staff = currentUser.user();
        String email = r.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) throw new CustomException(HttpStatus.CONFLICT, "Email already in use");
        String studentId = null;
        if (r.getRole() == Role.STUDENT) {
            studentId = r.getStudentId() == null ? "" : r.getStudentId().trim().toUpperCase(Locale.ROOT);
            if (studentId.isEmpty()) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Enter the number printed on the student ID card");
            if (memberRepository.existsByStudentIdIgnoreCase(studentId)) {
                throw new CustomException(HttpStatus.CONFLICT, "This ID card is already registered to another member");
            }
        }
        User user = userRepository.save(User.builder()
                .name(r.getName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(r.getPassword()))
                .role(r.getRole())
                .phone(r.getPhone())
                .title(r.getTitle())
                .active(true)
                .build());
        if (r.getRole() == Role.STUDENT) {
            memberRepository.save(Member.builder()
                    .user(user)
                    .studentId(studentId)
                    .program(r.getProgram() == null || r.getProgram().isBlank() ? "Undeclared" : r.getProgram().trim())
                    .year(r.getYear() == null ? 1 : r.getYear())
                    .memberToken(QrCodes.randomToken(20))
                    .status(MemberStatus.ACTIVE)
                    .joinedAt(Instant.now())
                    .expiresAt(Instant.now().plus(Duration.ofDays(365)))
                    .build());
        }
        auditService.log("USER_CREATED", "Created " + r.getRole().name().toLowerCase(Locale.ROOT) + " account for "
                + user.getName() + (studentId != null ? " (ID card " + studentId + ")" : ""), user.getId(), staff);
        return mapper.toUser(user);
    }

    @Transactional
    public UserResponse update(Long id, UserUpdate r) {
        User staff = currentUser.user();
        User user = getOrThrow(id);
        String email = r.getEmail().trim().toLowerCase(Locale.ROOT);
        if (!user.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmailIgnoreCase(email)) {
            throw new CustomException(HttpStatus.CONFLICT, "Email already in use");
        }
        boolean hasMember = memberRepository.findByUserId(id).isPresent();
        if (r.getRole() == Role.STUDENT && !hasMember) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Students must be registered with their ID card. Create a new student account instead.");
        }
        if (r.getRole() != Role.STUDENT && hasMember) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "A student account can't be turned into a staff account. Create a new staff account instead.");
        }
        if (id.equals(staff.getId()) && (!r.isActive() || r.getRole() != Role.LIBRARIAN)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "You can't deactivate or demote your own account.");
        }
        boolean roleChanged = user.getRole() != r.getRole();
        user.setName(r.getName().trim());
        user.setEmail(email);
        user.setPhone(r.getPhone());
        user.setTitle(r.getTitle());
        user.setRole(r.getRole());
        user.setActive(r.isActive());
        // A deactivated account must not keep receiving pushes on its phones.
        if (!r.isActive()) deviceTokenRepository.deleteByUserId(id);
        if (r.getPassword() != null && !r.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(r.getPassword()));
        }
        auditService.log(roleChanged ? "ROLE_CHANGED" : "USER_UPDATED",
                roleChanged ? user.getName() + " → " + r.getRole() : "Updated " + user.getName(), id, staff);
        return mapper.toUser(user);
    }

    @Transactional
    public void delete(Long id) {
        User staff = currentUser.user();
        User user = getOrThrow(id);
        if (id.equals(staff.getId())) throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "You cannot delete your own account.");
        Member m = memberRepository.findByUserId(id).orElse(null);
        if (m != null && loanRepository.existsByMemberId(m.getId())) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This member has borrowing history. Deactivate the account instead.");
        }
        if (loanRepository.existsByApprovedByIdOrReturnedToId(id, id)) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This staff member has processed transactions. Deactivate instead.");
        }
        try {
            notificationRepository.deleteByUserId(id);
            deviceTokenRepository.deleteByUserId(id);
            auditLogRepository.detachUser(id);
            if (m != null) memberRepository.delete(m);
            userRepository.delete(user);
            userRepository.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "This account is linked to library records. Deactivate it instead.");
        }
        auditService.log("USER_DELETED", "Deleted account " + user.getName(), id, staff);
    }

    private User getOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "User not found with id: " + id));
    }
}
