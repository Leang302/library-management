package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookResponse {

    private Long id;
    private String title;
    private String author;
    private String isbn;
    private String publisher;
    private Integer year;
    private String category;
    private String language;
    private String description;
    private String shelf;
    private Integer pages;
    private boolean archived;

    /** Copies not marked LOST. */
    private int totalCopies;
    private int availableCopies;
    private int borrowedCopies;
    private int reservedCopies;
}
