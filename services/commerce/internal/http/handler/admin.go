package handler

import (
	"errors"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productimport"
)

type productRequestExportJobRequest struct {
	CreatedAfter  *time.Time `json:"createdAfter,omitempty"`
	CreatedBefore *time.Time `json:"createdBefore,omitempty"`
}

func (h *Handler) PostAdminProductsImportJobs(c *gin.Context) {
	claims, ok := h.requireRole(c, "ADMIN")
	if !ok {
		return
	}

	if h.ProductImport == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "product import is not configured")
		return
	}

	excelFileHeader, err := c.FormFile("excelFile")
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "missing excelFile")
		return
	}

	excelFile, err := excelFileHeader.Open()
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read excelFile")
		return
	}
	defer func() {
		_ = excelFile.Close()
	}()

	var imagesZip multipart.File
	var imagesZipName string
	imagesZipHeader, err := c.FormFile("imagesZip")
	if err == nil {
		imagesZip, err = imagesZipHeader.Open()
		if err != nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read imagesZip")
			return
		}
		imagesZipName = imagesZipHeader.Filename
		defer func() {
			_ = imagesZip.Close()
		}()
	}

	job, err := h.ProductImport.Enqueue(c.Request.Context(), productimport.EnqueueInput{
		CreatedByUserID:   pgtype.UUID{Bytes: claims.UserID, Valid: true},
		ExcelFile:         excelFile,
		ExcelFileName:     excelFileHeader.Filename,
		ImagesZipFile:     imagesZip,
		ImagesZipFileName: imagesZipName,
		ImageBaseURL:      c.PostForm("imageBaseUrl"),
	})
	if err != nil {
		h.logError("create product import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create import job")
		return
	}

	createdAt := job.CreatedAt.Time
	c.JSON(http.StatusAccepted, oapi.ImportJob{
		Id:             job.ID,
		Type:           oapi.ImportJobType(job.Type),
		Status:         oapi.JobStatus(job.Status),
		Progress:       int(job.Progress),
		ResultFileUrl:  job.ResultFileUrl,
		ErrorReportUrl: job.ErrorReportUrl,
		CreatedAt:      createdAt,
	})
}

func (h *Handler) PostAdminProductRequestsExportJobs(c *gin.Context) {
	claims, ok := h.requireRole(c, "ADMIN")
	if !ok {
		return
	}

	var request productRequestExportJobRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	job, err := h.TrackingStore.CreateImportJob(c.Request.Context(), db.CreateImportJobParams{
		Type:            string(oapi.ImportJobTypePRODUCTREQUESTEXPORT),
		Status:          string(oapi.PENDING),
		Progress:        0,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
	})
	if err != nil {
		h.logError("create export job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create export job")
		return
	}

	createdAt := job.CreatedAt.Time
	c.JSON(http.StatusAccepted, oapi.ImportJob{
		Id:             job.ID,
		Type:           oapi.ImportJobType(job.Type),
		Status:         oapi.JobStatus(job.Status),
		Progress:       int(job.Progress),
		ResultFileUrl:  job.ResultFileUrl,
		ErrorReportUrl: job.ErrorReportUrl,
		CreatedAt:      createdAt,
	})
}

func (h *Handler) GetAdminImportJobsJobId(c *gin.Context) {
	_, ok := h.requireRole(c, "ADMIN")
	if !ok {
		return
	}

	jobID, err := uuid.Parse(strings.TrimSpace(c.Param("jobId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid job id")
		return
	}

	job, err := h.TrackingStore.GetImportJob(c.Request.Context(), jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "import job not found")
			return
		}
		h.logError("get import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch import job")
		return
	}

	createdAt := job.CreatedAt.Time
	c.JSON(http.StatusOK, oapi.ImportJob{
		Id:             job.ID,
		Type:           oapi.ImportJobType(job.Type),
		Status:         oapi.JobStatus(job.Status),
		Progress:       int(job.Progress),
		ResultFileUrl:  job.ResultFileUrl,
		ErrorReportUrl: job.ErrorReportUrl,
		CreatedAt:      createdAt,
	})
}
