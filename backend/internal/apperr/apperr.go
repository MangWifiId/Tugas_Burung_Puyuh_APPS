package apperr

import "net/http"

// Error membawa status HTTP dan pesan yang aman ditampilkan ke pengguna.
type Error struct {
	Status  int
	Message string
	Details any
}

func (e *Error) Error() string { return e.Message }

func New(status int, message string) *Error {
	return &Error{Status: status, Message: message}
}

func BadRequest(message string) *Error {
	return New(http.StatusBadRequest, message)
}

func Unauthorized(message string) *Error {
	return New(http.StatusUnauthorized, message)
}

func Forbidden(message string) *Error {
	return New(http.StatusForbidden, message)
}

func NotFound(message string) *Error {
	return New(http.StatusNotFound, message)
}

func Conflict(message string) *Error {
	return New(http.StatusConflict, message)
}

func Validation(message string, details any) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Message: message, Details: details}
}
