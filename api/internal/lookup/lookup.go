package lookup

import (
	"context"
	"errors"

	"warta.com/api/internal/evidence"
	"warta.com/api/internal/report"
	"warta.com/api/internal/user"
)

// ReportCaller adapts user.User to report.Caller for authorization checks.
func ReportCaller(ctx context.Context, store user.Store, userID string) (*report.Caller, error) {
	u, err := store.FindByID(ctx, userID)
	if errors.Is(err, user.ErrNotFound) {
		return nil, report.ErrCallerNotFound
	}
	if err != nil {
		return nil, err
	}
	return &report.Caller{
		ID:            u.ID,
		DisplayName:   u.DisplayName,
		IsActive:      u.IsActive,
		EmailVerified: u.EmailVerifiedAt != nil,
	}, nil
}

// EvidenceCaller adapts user.User to evidence.Caller for authorization checks.
func EvidenceCaller(ctx context.Context, store user.Store, userID string) (*evidence.Caller, error) {
	u, err := store.FindByID(ctx, userID)
	if errors.Is(err, user.ErrNotFound) {
		return nil, evidence.ErrCallerNotFound
	}
	if err != nil {
		return nil, err
	}
	return &evidence.Caller{
		ID:            u.ID,
		DisplayName:   u.DisplayName,
		IsActive:      u.IsActive,
		EmailVerified: u.EmailVerifiedAt != nil,
	}, nil
}

// ReportReadable checks if a report is readable (non-draft reports always readable,
// draft reports only readable by their author).
func ReportReadable(ctx context.Context, reportStore report.Store, reportID string, callerID string) (bool, error) {
	r, err := reportStore.FindByID(ctx, reportID)
	if err != nil {
		return false, err
	}
	if r.Status == report.StatusDraft {
		return callerID != "" && callerID == r.UserID, nil
	}
	return true, nil
}


