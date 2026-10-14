package com.api.v1.library.service;

import com.api.v1.library.common.enumerates.BookSortEnum;
import com.api.v1.library.model.request.BookRequest;
import com.api.v1.library.model.response.BookDetailResponse;
import com.api.v1.library.model.response.BookResponse;
import com.api.v1.library.model.response.CopyResponse;
import com.api.v1.library.model.update.BookUpdate;
import com.api.v1.library.model.update.CopyStatusUpdate;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

public interface BookService {

    Page<BookResponse> list(int page, int size, BookSortEnum sort, Sort.Direction direction,
                            String q, String category, boolean availableOnly, boolean includeArchived);

    BookDetailResponse get(Long id);

    List<String> categories();

    BookResponse create(BookRequest request);

    BookResponse update(Long id, BookUpdate request);

    List<CopyResponse> addCopies(Long id, int count);

    BookResponse setArchived(Long id, boolean archived);

    void delete(Long id);

    CopyResponse getCopy(String code);

    CopyResponse updateCopyStatus(String code, CopyStatusUpdate request);
}
