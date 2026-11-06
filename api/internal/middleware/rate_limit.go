package middleware

import (
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
)

// RateLimiter is a fixed-window, per-IP limiter backed by process memory.
//
// The catalogue requires 429 + code rate_limited + Retry-After (§9.2, §13.4).
// Login defaults to 10/minute/IP and register to 5/hour/IP per §13.4. (The
// TASK.md checklist lists 5/min and 3/min; api-requirements §13.4 is the
// source-of-truth document for abuse limits, so its values are implemented.
// Both are configurable via env, so ops can tighten without new code.)
//
// A fixed window can admit up to 2x the limit across a window boundary.
// That is accepted for an auth gate of this size; switching to a sliding
// window belongs in the same change as the real distributed store (Redis).
type RateLimiter struct {
	max    int64
	window time.Duration

	mu      sync.Mutex
	buckets map[string]*windowBucket
}

// windowBucket is one window of hits for one key.
type windowBucket struct {
	epoch int64 // unix seconds / window
	hits  int64
}

// NewRateLimiter allows max events per IP per window.
func NewRateLimiter(max int64, window time.Duration) *RateLimiter {
	return &RateLimiter{
		max:     max,
		window:  window,
		buckets: make(map[string]*windowBucket),
	}
}

// Middleware returns the Fiber handler enforcing the limit.
func (r *RateLimiter) Middleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		now := time.Now()
		epoch := now.Unix() / int64(r.window.Seconds())
		ip := c.IP()

		r.mu.Lock()
		r.prune(epoch)
		bucket := r.buckets[ip]
		if bucket == nil || bucket.epoch != epoch {
			bucket = &windowBucket{epoch: epoch}
			r.buckets[ip] = bucket
		}
		bucket.hits++
		remaining := int64(r.window.Seconds()) - (now.Unix() % int64(r.window.Seconds()))
		r.mu.Unlock()

		if bucket.hits > r.max {
			c.Set(fiber.HeaderRetryAfter, strconv.FormatInt(remaining, 10))
			return httpx.Error(c, fiber.StatusTooManyRequests,
				"rate_limited", "Too many requests. Try again later.")
		}
		return c.Next()
	}
}

// prune drops stale buckets once the map grows beyond a comfortable size.
// It must be called with the mutex held. Auth traffic is a tiny fraction of
// requests, so memory is bounded by distinct abusive IPs seen recently.
func (r *RateLimiter) prune(currentEpoch int64) {
	if len(r.buckets) < 8192 {
		return
	}
	for ip, bucket := range r.buckets {
		if bucket.epoch < currentEpoch {
			delete(r.buckets, ip)
		}
	}
}
