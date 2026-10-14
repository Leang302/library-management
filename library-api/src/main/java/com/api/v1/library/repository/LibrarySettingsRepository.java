package com.api.v1.library.repository;

import com.api.v1.library.model.entity.LibrarySettings;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LibrarySettingsRepository extends JpaRepository<LibrarySettings, Long> {
}
