package com.api.v1.library.service;

/** Time-based status changes (overdue loans, expired QR passes and holds), run on a schedule. */
public interface StatusMaintenanceService {

    void refreshStatuses();
}
