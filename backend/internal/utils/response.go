package utils

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type Meta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": data})
}

func Paginated(c *gin.Context, data any, meta Meta) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data, "meta": meta})
}

func NoContent(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "data berhasil dihapus"})
}

func Fail(c *gin.Context, status int, message string, details any) {
	body := gin.H{"success": false, "error": message}
	if details != nil {
		body["details"] = details
	}
	c.JSON(status, body)
}

// HandleError memetakan error aplikasi ke response HTTP yang konsisten.
func HandleError(c *gin.Context, err error) {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		Fail(c, appErr.Status, appErr.Message, appErr.Details)
		return
	}
	Fail(c, http.StatusInternalServerError, "terjadi kesalahan pada server", nil)
}

func BindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		Fail(c, http.StatusBadRequest, "data yang dikirim tidak valid", err.Error())
		return false
	}
	return true
}

func Pagination(c *gin.Context) (page, limit, offset int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	return page, limit, (page - 1) * limit
}

func BuildMeta(page, limit int, total int64) Meta {
	totalPages := int((total + int64(limit) - 1) / int64(limit))
	return Meta{Page: page, Limit: limit, Total: total, TotalPages: totalPages}
}

func ParseID(c *gin.Context) (uint, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		return 0, apperr.BadRequest("ID tidak valid")
	}
	return uint(id), nil
}

func ParseDateQuery(value string) (models.Date, error) {
	parsed, err := models.ParseDate(value)
	if err != nil {
		return models.Date{}, apperr.BadRequest("format tanggal harus YYYY-MM-DD")
	}
	return parsed, nil
}

// DateRange membaca from/to. Bila kosong, memakai rentang default 30 hari
// terakhir (termasuk hari ini). Nilai to selalu akhir hari secara inklusif.
func DateRange(c *gin.Context, defaultDays int) (models.Date, models.Date, error) {
	now := time.Now()
	fromDefault := models.NewDate(now.AddDate(0, 0, -(defaultDays - 1)))
	toDefault := models.NewDate(now)

	from, to := fromDefault, toDefault
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		parsed, err := models.ParseDate(raw)
		if err != nil {
			return from, to, apperr.BadRequest("parameter from harus berformat YYYY-MM-DD")
		}
		from = parsed
	}
	if raw := strings.TrimSpace(c.Query("to")); raw != "" {
		parsed, err := models.ParseDate(raw)
		if err != nil {
			return from, to, apperr.BadRequest("parameter to harus berformat YYYY-MM-DD")
		}
		to = parsed
	}
	if from.After(to) {
		return from, to, apperr.BadRequest("tanggal awal tidak boleh melebihi tanggal akhir")
	}
	if from.Time().AddDate(0, 0, 366*2).Before(to.Time()) {
		return from, to, apperr.BadRequest("rentang tanggal maksimal 2 tahun")
	}
	return from, to, nil
}

func DateOnly(t time.Time) models.Date { return models.NewDate(t) }
