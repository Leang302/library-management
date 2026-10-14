package com.api.v1.library.controller;

import com.api.v1.library.common.enumerates.BookSortEnum;
import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.AddCopiesRequest;
import com.api.v1.library.model.request.ArchiveRequest;
import com.api.v1.library.model.request.BookRequest;
import com.api.v1.library.model.response.BookDetailResponse;
import com.api.v1.library.model.response.BookResponse;
import com.api.v1.library.model.response.CopyResponse;
import com.api.v1.library.model.update.BookUpdate;
import com.api.v1.library.service.BookService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/books")
@RequiredArgsConstructor
@Validated
@Tag(name = "Books", description = "Catalogue (everyone) and book management (librarians)")
public class BookController {
    private final BookService bookService;

    @GetMapping
    @Operation(summary = "Search the catalogue")
    public ResponseEntity<PaginationResponse<List<BookResponse>>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "title") BookSortEnum sort,
            @RequestParam(defaultValue = "ASC") Sort.Direction direction,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean availableOnly,
            @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK,
                        bookService.list(page, size, sort, direction, q, category, availableOnly, includeArchived),
                        "Books retrieved successfully")
        );
    }

    @GetMapping("/categories")
    @Operation(summary = "Categories in use")
    public ResponseEntity<SuccessResponse<List<String>>> categories() {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.categories(), "Categories retrieved successfully")
        );
    }

    @GetMapping("/{id}")
    @Operation(summary = "Book details with copies and reservation queue")
    public ResponseEntity<SuccessResponse<BookDetailResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.get(id), "Book retrieved successfully")
        );
    }

    @PostMapping
    @Operation(summary = "Add a title and its physical copies")
    public ResponseEntity<SuccessResponse<BookResponse>> create(@Valid @RequestBody BookRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                APIResponseUtil.success(HttpStatus.CREATED, bookService.create(request), "Book created successfully")
        );
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit a title")
    public ResponseEntity<SuccessResponse<BookResponse>> update(@PathVariable Long id, @Valid @RequestBody BookUpdate request) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.update(id, request), "Book updated successfully")
        );
    }

    @PostMapping("/{id}/copies")
    @Operation(summary = "Add physical copies")
    public ResponseEntity<SuccessResponse<List<CopyResponse>>> addCopies(@PathVariable Long id, @Valid @RequestBody AddCopiesRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                APIResponseUtil.success(HttpStatus.CREATED, bookService.addCopies(id, request.getCount()), "Copies added successfully")
        );
    }

    @PatchMapping("/{id}/archive")
    @Operation(summary = "Archive or restore a title")
    public ResponseEntity<SuccessResponse<BookResponse>> archive(@PathVariable Long id, @RequestBody ArchiveRequest request) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.setArchived(id, request.isArchived()),
                        request.isArchived() ? "Book archived successfully" : "Book restored successfully")
        );
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a title that has never been borrowed")
    public ResponseEntity<SuccessResponse<Void>> delete(@PathVariable Long id) {
        bookService.delete(id);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Book deleted successfully"));
    }
}
