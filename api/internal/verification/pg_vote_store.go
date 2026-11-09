package verification

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PGVoteStore reads votes from PostgreSQL (migration M5). Each row joins the
// voted item, its project, and the item author's display name per §7.5;
// the vote counters and status come from the item's live row so `resolution`
// is always the current outcome (§6.22), never a voting-time snapshot.
type PGVoteStore struct {
	pool *pgxpool.Pool
}

// NewPGVoteStore wraps an existing connection pool.
func NewPGVoteStore(pool *pgxpool.Pool) *PGVoteStore { return &PGVoteStore{pool: pool} }

// ListByUser lists the caller's votes, newest first, each carrying the voted
// item's current outcome. Pagination follows §10.4.
func (s *PGVoteStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
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
		var choice, status string
		if err := rows.Scan(&v.ID, &v.VoterID, &v.VerificationItemID, &v.ProjectID, &v.ProjectTitle,
			&v.ItemType, &v.AuthorDisplayName, &choice, &v.CreatedAt,
			&status, &v.VotesAgree, &v.VotesDisagree, &v.TargetVotes,
			&v.ResolvedAt); err != nil {
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

// clampPage applies §10.4 pagination defaults.
func clampPage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}