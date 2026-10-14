package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.response.SettingsResponse;
import com.api.v1.library.model.update.SettingsUpdate;
import com.api.v1.library.repository.LibrarySettingsRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.SettingsService;
import com.api.v1.library.util.QrCodes;

import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SettingsServiceImpl implements SettingsService {

    private final LibrarySettingsRepository settingsRepository;
    private final AuditService auditService;
    private final CurrentUserService currentUser;
    private final ModelMapper modelMapper;

    @Override
    @Transactional
    public LibrarySettings settings() {
        return settingsRepository.findById(LibrarySettings.SINGLETON_ID)
                .orElseGet(() -> settingsRepository.save(
                        LibrarySettings.builder().id(LibrarySettings.SINGLETON_ID).build()));
    }

    @Override
    @Transactional
    public SettingsResponse get() {
        return modelMapper.map(settings(), SettingsResponse.class);
    }

    @Override
    @Transactional
    public SettingsResponse update(SettingsUpdate request) {
        LibrarySettings settings = settings();
        modelMapper.map(request, settings);
        settings.setLibraryName(request.getLibraryName().trim());
        auditService.log("SETTINGS_UPDATED", "Borrowing policy updated", null, currentUser.user());
        return modelMapper.map(settingsRepository.save(settings), SettingsResponse.class);
    }

    @Override
    @Transactional
    public String nextCopyId() {
        LibrarySettings settings = settings();
        long next = settings.getCopySeq() + 1;
        settings.setCopySeq(next);
        settingsRepository.save(settings);
        return QrCodes.copyIdFor(next);
    }
}
