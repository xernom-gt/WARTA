package report

import (
	"context"
	"strings"
	"sync"
)

// MediaStorage persists and removes uploaded report photo binaries (§6.15, §11.1).
type MediaStorage interface {
	// Put stores data under key with contentType and returns its public URL.
	Put(ctx context.Context, key string, contentType string, data []byte) (string, error)

	// Delete removes the object corresponding to fileURL from storage.
	Delete(ctx context.Context, fileURL string) error
}

// MemoryMediaStorage is the default in-memory MediaStorage used in local dev
// and handler tests when no external S3/MinIO bucket is configured.
type MemoryMediaStorage struct {
	baseURL string
	mu      sync.Mutex
	objects map[string][]byte
}

// NewMemoryMediaStorage creates an in-memory object store rooted at baseURL.
func NewMemoryMediaStorage(baseURL string) *MemoryMediaStorage {
	if baseURL == "" {
		baseURL = "https://storage.warta.id"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	return &MemoryMediaStorage{
		baseURL: baseURL,
		objects: map[string][]byte{},
	}
}

// Put stores a copy of data and returns its canonical URL.
func (s *MemoryMediaStorage) Put(_ context.Context, key string, _ string, data []byte) (string, error) {
	key = strings.TrimLeft(key, "/")
	url := s.baseURL + "/" + key
	buf := make([]byte, len(data))
	copy(buf, data)

	s.mu.Lock()
	s.objects[url] = buf
	s.mu.Unlock()
	return url, nil
}

// Delete removes the stored object at fileURL.
func (s *MemoryMediaStorage) Delete(_ context.Context, fileURL string) error {
	s.mu.Lock()
	delete(s.objects, fileURL)
	s.mu.Unlock()
	return nil
}

// Has reports whether fileURL currently exists in memory storage.
func (s *MemoryMediaStorage) Has(fileURL string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.objects[fileURL]
	return ok
}
