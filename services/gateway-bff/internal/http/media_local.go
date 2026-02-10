package http

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
)

const defaultMediaLocalCacheMaxAgeSecond = 3600

type LocalMediaHandler struct {
	rootDir           string
	rootDirAbs        string
	cacheMaxAgeSecond int
	logger            *slog.Logger
}

func NewLocalMediaHandler(rootDir string, cacheMaxAgeSecond int, logger *slog.Logger) *LocalMediaHandler {
	normalizedRoot := strings.TrimSpace(rootDir)
	rootAbs := ""
	if normalizedRoot != "" {
		abs, err := filepath.Abs(normalizedRoot)
		if err == nil {
			rootAbs = abs
		}
	}
	if cacheMaxAgeSecond <= 0 {
		cacheMaxAgeSecond = defaultMediaLocalCacheMaxAgeSecond
	}
	return &LocalMediaHandler{
		rootDir:           normalizedRoot,
		rootDirAbs:        rootAbs,
		cacheMaxAgeSecond: cacheMaxAgeSecond,
		logger:            logger,
	}
}

func (h *LocalMediaHandler) Handle(c *gin.Context) {
	if h.rootDirAbs == "" {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "media_local_disabled",
			Message: "local media server is disabled",
		})
		return
	}

	relativePath := strings.TrimSpace(c.Param("path"))
	relativePath = strings.TrimPrefix(relativePath, "/")
	if relativePath == "" {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "media_path_required",
			Message: "media path is required",
		})
		return
	}

	cleaned := path.Clean("/" + relativePath)
	if cleaned == "/" {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "media_path_invalid",
			Message: "invalid media path",
		})
		return
	}

	cleaned = strings.TrimPrefix(cleaned, "/")
	targetPath := filepath.Join(h.rootDirAbs, filepath.FromSlash(cleaned))
	targetAbs, err := filepath.Abs(targetPath)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "media_path_invalid",
			Message: "invalid media path",
		})
		return
	}
	if !isPathUnderRoot(targetAbs, h.rootDirAbs) {
		apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
			Code:    "media_path_forbidden",
			Message: "media path escapes root directory",
		})
		return
	}

	file, err := os.Open(targetAbs)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
				Code:    "media_not_found",
				Message: "media file not found",
			})
			return
		}
		if h.logger != nil {
			h.logger.Error("open local media file failed", "error", err, "path", targetAbs)
		}
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "media_open_failed",
			Message: "failed to open media file",
		})
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		if h.logger != nil {
			h.logger.Error("stat local media file failed", "error", err, "path", targetAbs)
		}
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "media_stat_failed",
			Message: "failed to read media metadata",
		})
		return
	}
	if stat.IsDir() {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "media_not_found",
			Message: "media file not found",
		})
		return
	}

	contentType := detectContentType(file)
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "media_read_failed",
			Message: "failed to read media file",
		})
		return
	}

	c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", h.cacheMaxAgeSecond))
	if contentType != "" {
		c.Header("Content-Type", contentType)
	}
	http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), file)
}

func isPathUnderRoot(targetPath, rootPath string) bool {
	target := filepath.Clean(targetPath)
	root := filepath.Clean(rootPath)
	if target == root {
		return true
	}
	return strings.HasPrefix(target, root+string(filepath.Separator))
}

func detectContentType(file *os.File) string {
	if file == nil {
		return ""
	}
	buffer := make([]byte, 512)
	size, err := file.Read(buffer)
	if err != nil || size <= 0 {
		return ""
	}
	return http.DetectContentType(buffer[:size])
}
