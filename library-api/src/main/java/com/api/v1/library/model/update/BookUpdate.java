package com.api.v1.library.model.update;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Edit a title. Copies are added separately (POST /books/{id}/copies). */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class BookUpdate {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Author is required")
    private String author;

    @NotBlank(message = "ISBN is required")
    @Schema(example = "9780735211292")
    private String isbn;

    private String publisher;

    @Min(value = 1450, message = "Enter a valid year")
    @Max(value = 2100, message = "Enter a valid year")
    private Integer year;

    @NotBlank(message = "Choose a category")
    private String category;

    private String language;

    private String description;

    private String shelf;

    @Min(value = 1, message = "Pages must be positive")
    private Integer pages;
}
