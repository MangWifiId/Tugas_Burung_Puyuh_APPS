package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type SuccessEnvelope struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginatedEnvelope struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data"`
	Meta    Pagination  `json:"meta"`
}

type Pagination struct {
	Page         int   `json:"page"`
	Limit        int   `json:"limit"`
	TotalRecords int64 `json:"total_records"`
	TotalPages   int   `json:"total_pages"`
}

type ErrorDetail struct {
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

type ErrorBody struct {
	Code    string        `json:"code"`
	Message string        `json:"message"`
	Details []ErrorDetail `json:"details,omitempty"`
}

type ErrorEnvelope struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
}

func JSON(c *gin.Context, statusCode int, message string, data interface{}) {
	c.JSON(statusCode, SuccessEnvelope{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func Paginated(c *gin.Context, statusCode int, message string, data interface{}, page, limit int, totalRecords int64) {
	totalPages := int((totalRecords + int64(limit) - 1) / int64(limit))
	if totalPages == 0 && totalRecords == 0 {
		totalPages = 1
	}

	c.JSON(statusCode, PaginatedEnvelope{
		Success: true,
		Message: message,
		Data:    data,
		Meta: Pagination{
			Page:         page,
			Limit:        limit,
			TotalRecords: totalRecords,
			TotalPages:   totalPages,
		},
	})
}

func Error(c *gin.Context, statusCode int, errorCode string, message string, details ...ErrorDetail) {
	c.JSON(statusCode, ErrorEnvelope{
		Success: false,
		Error: ErrorBody{
			Code:    errorCode,
			Message: message,
			Details: details,
		},
	})
}

func BadRequest(c *gin.Context, message string, details ...ErrorDetail) {
	Error(c, http.StatusBadRequest, "BAD_REQUEST", message, details...)
}

func ValidationError(c *gin.Context, message string, details ...ErrorDetail) {
	Error(c, http.StatusBadRequest, "VALIDATION_ERROR", message, details...)
}

func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, "UNAUTHORIZED", message)
}

func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, "FORBIDDEN", message)
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, "NOT_FOUND", message)
}

func Conflict(c *gin.Context, message string) {
	Error(c, http.StatusConflict, "CONFLICT", message)
}

func Unprocessable(c *gin.Context, message string) {
	Error(c, http.StatusUnprocessableEntity, "BUSINESS_RULE_VIOLATION", message)
}

func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", message)
}
