package httpx

import (
	"net/http"
	"time"
)

const UploadRequestTimeout = 2 * time.Minute

func NewServer(addr string, router http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

// NewUploadServer allows bounded, multi-megabyte uploads enough time to be
// received and processed without weakening the default timeout for APIs that
// do not accept uploaded files.
func NewUploadServer(addr string, router http.Handler) *http.Server {
	server := NewServer(addr, router)
	server.ReadTimeout = UploadRequestTimeout
	server.WriteTimeout = UploadRequestTimeout
	return server
}
