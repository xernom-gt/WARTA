package report

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// S3Config holds the settings needed to talk to an S3-compatible object store (§11.1).
type S3Config struct {
	Endpoint        string // e.g. "http://localhost:9000" or "https://s3.amazonaws.com"
	Region          string // e.g. "us-east-1"
	Bucket          string // e.g. "warta-media"
	AccessKeyID     string
	SecretAccessKey string
	PublicURL       string // optional public base URL (e.g. "https://storage.warta.id")
	ForcePathStyle  bool   // true for MinIO/local, false for AWS S3
}

// S3MediaStorage implements MediaStorage using S3 / MinIO / Cloudflare R2 (§11.1).
type S3MediaStorage struct {
	cfg        S3Config
	httpClient *http.Client
}

// NewS3MediaStorage creates a new S3MediaStorage.
func NewS3MediaStorage(cfg S3Config) *S3MediaStorage {
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	cfg.Endpoint = strings.TrimRight(cfg.Endpoint, "/")
	cfg.PublicURL = strings.TrimRight(cfg.PublicURL, "/")
	return &S3MediaStorage{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *S3MediaStorage) buildURL(key string) string {
	key = strings.TrimLeft(key, "/")
	if s.cfg.ForcePathStyle || strings.Contains(s.cfg.Endpoint, "localhost") || strings.Contains(s.cfg.Endpoint, "127.0.0.1") {
		return fmt.Sprintf("%s/%s/%s", s.cfg.Endpoint, s.cfg.Bucket, key)
	}
	trimmed := strings.TrimPrefix(s.cfg.Endpoint, "https://")
	trimmed = strings.TrimPrefix(trimmed, "http://")
	scheme := "https://"
	if strings.HasPrefix(s.cfg.Endpoint, "http://") {
		scheme = "http://"
	}
	return fmt.Sprintf("%s%s.%s/%s", scheme, s.cfg.Bucket, trimmed, key)
}

func (s *S3MediaStorage) canonicalURL(key string) string {
	key = strings.TrimLeft(key, "/")
	if s.cfg.PublicURL != "" {
		return s.cfg.PublicURL + "/" + key
	}
	return s.buildURL(key)
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func (s *S3MediaStorage) signRequest(req *http.Request, payload []byte) {
	if s.cfg.AccessKeyID == "" || s.cfg.SecretAccessKey == "" {
		return
	}

	t := time.Now().UTC()
	amzDate := t.Format("20060102T150405Z")
	dateStamp := t.Format("20060102")

	req.Header.Set("x-amz-date", amzDate)
	payloadHash := sha256Hex(payload)
	req.Header.Set("x-amz-content-sha256", payloadHash)

	host := req.URL.Host
	req.Header.Set("Host", host)

	canonicalURI := req.URL.Path
	if canonicalURI == "" {
		canonicalURI = "/"
	}
	canonicalQuery := req.URL.RawQuery

	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		host, payloadHash, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		req.Method, canonicalURI, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash)

	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, s.cfg.Region)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s",
		amzDate, credentialScope, sha256Hex([]byte(canonicalRequest)))

	kDate := hmacSHA256([]byte("AWS4"+s.cfg.SecretAccessKey), dateStamp)
	kRegion := hmacSHA256(kDate, s.cfg.Region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")

	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.cfg.AccessKeyID, credentialScope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)
}

// Put uploads binary data to S3.
func (s *S3MediaStorage) Put(ctx context.Context, key string, contentType string, data []byte) (string, error) {
	targetURL := s.buildURL(key)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, targetURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	s.signRequest(req, data)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("s3 put %s: %w", key, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", fmt.Errorf("s3 put %s returned status %d: %s", key, resp.StatusCode, string(respBody))
	}

	return s.canonicalURL(key), nil
}

// Delete removes the object from S3.
func (s *S3MediaStorage) Delete(ctx context.Context, fileURL string) error {
	u, err := url.Parse(fileURL)
	if err != nil {
		return err
	}
	path := strings.TrimPrefix(u.Path, "/")
	if s.cfg.ForcePathStyle && strings.HasPrefix(path, s.cfg.Bucket+"/") {
		path = strings.TrimPrefix(path, s.cfg.Bucket+"/")
	}

	targetURL := s.buildURL(path)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, targetURL, nil)
	if err != nil {
		return err
	}
	s.signRequest(req, nil)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("s3 delete %s: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("s3 delete %s returned status %d: %s", path, resp.StatusCode, string(respBody))
	}
	return nil
}

// Ping checks if S3/MinIO bucket is reachable.
func (s *S3MediaStorage) Ping(ctx context.Context) error {
	bucketURL := s.cfg.Endpoint
	if s.cfg.ForcePathStyle || strings.Contains(s.cfg.Endpoint, "localhost") {
		bucketURL = fmt.Sprintf("%s/%s", s.cfg.Endpoint, s.cfg.Bucket)
	} else {
		trimmed := strings.TrimPrefix(s.cfg.Endpoint, "https://")
		trimmed = strings.TrimPrefix(trimmed, "http://")
		scheme := "https://"
		if strings.HasPrefix(s.cfg.Endpoint, "http://") {
			scheme = "http://"
		}
		bucketURL = fmt.Sprintf("%s%s.%s", scheme, s.cfg.Bucket, trimmed)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, bucketURL, nil)
	if err != nil {
		return err
	}
	s.signRequest(req, nil)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("s3 head bucket returned %d", resp.StatusCode)
	}
	return nil
}
