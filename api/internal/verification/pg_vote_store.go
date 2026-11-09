package verification

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGVoteStore reads and writes votes to PostgreSQL.
type PGVoteStore struct {
	pool *pgxpool.Pool
}

// NewPGVoteStore wraps an existing connection pool.
func NewPGVoteStore(pool *pgxpool.Pool) *PGVoteStore { return &PGVoteStore{pool: pool} }

// ListByUser lists the caller's votes, newest first, each carrying the voted
// item's current outcome. Pagination follows §10.4.
func (s *PGVoteStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := ClampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	var total int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM verification_votes vv
		WHERE vv.user_id = $1`, userID).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT vv.id, vv.user_id, vv.verification_item_id, vi.project_id, p.title,
			vi.item_type, author.display_name, vv.choice, vv.created_at,
			vi.status, vi.votes_agree, vi.votes_disagree, vi.target_votes,
			vi.resolved_at
		FROM verification_votes vv
		JOIN verification_items vi ON vi.id = vv.verification_item_id
		JOIN projects p ON p.id = vi.project_id
		JOIN users author ON author.id = vi.author_user_id
		WHERE vv.user_id = $1
		ORDER BY vv.created_at DESC
		LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	votes := make([]*Vote, 0, limit)
	for rows.Next() {
		v := new(Vote)
		var choice string
		var status string
		if err := rows.Scan(&v.ID, &v.VoterID, &v.VerificationItemID, &v.ProjectID,
			&v.ProjectTitle, &v.ItemType, &v.AuthorDisplayName, &choice,
			&v.CreatedAt, &status, &v.VotesAgree, &v.VotesDisagree,
			&v.TargetVotes, &v.ResolvedAt); err != nil {
			return nil, err
		}
		v.Choice = VoteChoice(choice)
		v.Status = VoteResolutionStatus(status)
		votes = append(votes, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListResult{
		Data: votes,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(votes) < total,
		},
	}, nil
}

// ListByItem returns paginated votes for a verification item (§5.5, openapi VoteListResponse).
func (s *PGVoteStore) ListByItem(ctx context.Context, itemID string, filter ListFilter) (*ItemVoteListResult, error) {
	// First verify item exists
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM verification_items WHERE id = $1)`, itemID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrItemNotFound
	}

	page, limit := ClampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	var total int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM verification_votes
		WHERE verification_item_id = $1`, itemID).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, verification_item_id, user_id, choice, created_at
		FROM verification_votes
		WHERE verification_item_id = $1
		ORDER BY created_at ASC, id ASC
		LIMIT $2 OFFSET $3`, itemID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	votes := make([]ItemVoteView, 0, limit)
	for rows.Next() {
		var v Vote
		var choice string
		if err := rows.Scan(&v.ID, &v.VerificationItemID, &v.VoterID, &choice, &v.CreatedAt); err != nil {
			return nil, err
		}
		v.Choice = VoteChoice(choice)
		votes = append(votes, v.ItemView())
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ItemVoteListResult{
		Data: votes,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(votes) < total,
		},
	}, nil
}

// CastVote records a citizen's vote, performs atomic counter updates,
// and triggers automatic resolution upon reaching target_votes.
func (s *PGVoteStore) CastVote(ctx context.Context, itemID, userID string, choice VoteChoice) (*ItemVoteView, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Fetch item with lock (FOR UPDATE)
	var (
		authorID      string
		itemStatus    string
		itemType      string
		projectID     string
		reportID      *string
		claimID       *string
		votesAgree    int
		votesDisagree int
		targetVotes   int
	)
	err = tx.QueryRow(ctx, `
		SELECT author_user_id, status, item_type, project_id, report_id, claim_id,
		       votes_agree, votes_disagree, target_votes
		FROM verification_items
		WHERE id = $1
		FOR UPDATE
	`, itemID).Scan(&authorID, &itemStatus, &itemType, &projectID, &reportID, &claimID,
		&votesAgree, &votesDisagree, &targetVotes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrItemNotFound
		}
		return nil, err
	}

	// Rule 1: Item already resolved -> 409
	if itemStatus != string(ItemStatusMenunggu) {
		return nil, ErrItemResolved
	}

	// Rule 2: Self-vote prevention -> 403
	if authorID == userID {
		return nil, ErrSelfVote
	}

	// Rule 3: Duplicate vote check -> 409
	var alreadyVoted bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM verification_votes WHERE verification_item_id = $1 AND user_id = $2
		)
	`, itemID, userID).Scan(&alreadyVoted)
	if err != nil {
		return nil, err
	}
	if alreadyVoted {
		return nil, ErrDuplicateVote
	}

	// 2. Insert vote
	var voteID string
	var voteCreatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO verification_votes (verification_item_id, user_id, choice)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`, itemID, userID, string(choice)).Scan(&voteID, &voteCreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert vote: %w", err)
	}

	// 3. Increment counter atomically
	if choice == ChoiceSetuju {
		votesAgree++
	} else {
		votesDisagree++
	}

	// 4. Check consensus threshold
	now := time.Now().UTC()
	var newStatus = itemStatus
	var resolvedAt *time.Time

	if votesAgree >= targetVotes {
		resolvedAt = &now
		if itemType == string(ItemTypeKlaimLokasi) {
			newStatus = string(ItemStatusDiterima)
			// Trigger acceptance side-effects for location claims
			if claimID != nil {
				if err := acceptClaimInTx(ctx, tx, *claimID, projectID, now); err != nil {
					return nil, err
				}
			}
		} else {
			// Laporan kondisi resolves to terverifikasi
			newStatus = string(ItemStatusTerverifikasi)
			if reportID != nil {
				_, _ = tx.Exec(ctx, `UPDATE reports SET status = 'terverifikasi', updated_at = $1 WHERE id = $2`, now, *reportID)
			}
		}
	} else if votesDisagree >= targetVotes {
		resolvedAt = &now
		newStatus = string(ItemStatusDitolak)
		if claimID != nil {
			_, _ = tx.Exec(ctx, `UPDATE location_claims SET status = 'ditolak', decided_at = $1, updated_at = $1 WHERE id = $2`, now, *claimID)
		}
		if reportID != nil {
			_, _ = tx.Exec(ctx, `UPDATE reports SET status = 'ditolak', updated_at = $1 WHERE id = $2`, now, *reportID)
		}
	}

	// 5. Update verification item counters and resolution
	_, err = tx.Exec(ctx, `
		UPDATE verification_items
		SET votes_agree = $1, votes_disagree = $2, status = $3, resolved_at = $4
		WHERE id = $5
	`, votesAgree, votesDisagree, newStatus, resolvedAt, itemID)
	if err != nil {
		return nil, fmt.Errorf("update item: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ItemVoteView{
		ID:                 voteID,
		VerificationItemID: itemID,
		UserID:             userID,
		Choice:             choice,
		CreatedAt:          httpx.ISO8601(voteCreatedAt),
	}, nil
}

func acceptClaimInTx(ctx context.Context, tx pgx.Tx, claimID, projectID string, now time.Time) error {
	var (
		proposedAddress   string
		proposedPrecision string
		latitude          *float64
		longitude         *float64
	)
	err := tx.QueryRow(ctx, `
		SELECT proposed_address, proposed_precision, latitude, longitude
		FROM location_claims WHERE id = $1
	`, claimID).Scan(&proposedAddress, &proposedPrecision, &latitude, &longitude)
	if err != nil {
		return err
	}

	// Demote old primary location
	_, _ = tx.Exec(ctx, `
		UPDATE project_locations SET is_primary = false, updated_at = $1
		WHERE project_id = $2 AND is_primary = true
	`, now, projectID)

	// Create new primary location from accepted claim
	_, err = tx.Exec(ctx, `
		INSERT INTO project_locations (
			project_id, name, address, city, precision_level, source,
			latitude, longitude, is_verified, is_primary, created_at, updated_at
		) VALUES (
			$1, NULL, $2, (SELECT city FROM projects WHERE id = $1), $3, 'warga',
			$4, $5, true, true, $6, $6
		)
	`, projectID, proposedAddress, proposedPrecision, latitude, longitude, now)
	if err != nil {
		return err
	}

	// Set project is_canonical_claimed = true
	_, err = tx.Exec(ctx, `UPDATE projects SET is_canonical_claimed = true, updated_at = $1 WHERE id = $2`, now, projectID)
	if err != nil {
		return err
	}

	// Set location claim status = diterima
	_, err = tx.Exec(ctx, `
		UPDATE location_claims SET status = 'diterima', decided_at = $1, updated_at = $1 WHERE id = $2
	`, now, claimID)
	return err
}
