package report

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestS3MediaStorage_URLBuilding(t *testing.T) {
	// Virtual host style
	s3 := NewS3MediaStorage(S3Config{
		Endpoint:        "https://s3.ap-southeast-1.amazonaws.com",
		Region:          "ap-southeast-1",
		Bucket:          "warta-bucket",
		AccessKeyID:     "test-key",
		SecretAccessKey: "test-secret",
	})
	u := s3.buildURL("reports/123/photo.jpg")
	expected := "https://warta-bucket.s3.ap-southeast-1.amazonaws.com/reports/123/photo.jpg"
	if u != expected {
		t.Errorf("expected virtual-host URL %q, got %q", expected, u)
	}

	// Path style (e.g. MinIO)
	minio := NewS3MediaStorage(S3Config{
		Endpoint:        "http://localhost:9000",
		Region:          "us-east-1",
		Bucket:          "warta-bucket",
		ForcePathStyle:  true,
		PublicURL:       "https://storage.warta.id",
	})
	uMinio := minio.buildURL("reports/123/photo.jpg")
	expectedMinio := "http://localhost:9000/warta-bucket/reports/123/photo.jpg"
	if uMinio != expectedMinio {
		t.Errorf("expected path-style URL %q, got %q", expectedMinio, uMinio)
	}

	canonical := minio.canonicalURL("reports/123/photo.jpg")
	expectedCanonical := "https://storage.warta.id/reports/123/photo.jpg"
	if canonical != expectedCanonical {
		t.Errorf("expected canonical URL %q, got %q", expectedCanonical, canonical)
	}
}

func TestS3MediaStorage_PutDeleteAndPing(t *testing.T) {
	var lastMethod string
	var lastPath string
	var lastAuth string
	var lastPayload []byte

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastMethod = r.Method
		lastPath = r.URL.Path
		lastAuth = r.Header.Get("Authorization")
		lastPayload, _ = io.ReadAll(r.Body)

		switch r.Method {
		case http.MethodPut:
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	defer ts.Close()

	s3 := NewS3MediaStorage(S3Config{
		Endpoint:        ts.URL,
		Region:          "us-east-1",
		Bucket:          "warta-bucket",
		AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		ForcePathStyle:  true,
		PublicURL:       "https://storage.warta.id",
	})
	s3.httpClient = ts.Client()

	ctx := context.Background()

	// 1. Put
	data := []byte("hello s3 media")
	fileURL, err := s3.Put(ctx, "evidences/test/photo.jpg", "image/jpeg", data)
	if err != nil {
		t.Fatalf("unexpected put error: %v", err)
	}
	if fileURL != "https://storage.warta.id/evidences/test/photo.jpg" {
		t.Errorf("expected public url, got %s", fileURL)
	}
	if lastMethod != http.MethodPut {
		t.Errorf("expected PUT method, got %s", lastMethod)
	}
	if !strings.Contains(lastPath, "evidences/test/photo.jpg") {
		t.Errorf("expected path to contain key, got %s", lastPath)
	}
	if !strings.Contains(lastAuth, "AWS4-HMAC-SHA256") {
		t.Errorf("expected SigV4 Authorization header, got %s", lastAuth)
	}
	if string(lastPayload) != string(data) {
		t.Errorf("payload mismatch")
	}

	// 2. Delete
	err = s3.Delete(ctx, fileURL)
	if err != nil {
		t.Fatalf("unexpected delete error: %v", err)
	}
	if lastMethod != http.MethodDelete {
		t.Errorf("expected DELETE method, got %s", lastMethod)
	}

	// 3. Ping
	err = s3.Ping(ctx)
	if err != nil {
		t.Fatalf("unexpected ping error: %v", err)
	}
	if lastMethod != http.MethodHead {
		t.Errorf("expected HEAD method, got %s", lastMethod)
	}
}
