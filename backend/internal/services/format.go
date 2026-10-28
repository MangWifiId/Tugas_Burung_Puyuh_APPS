package services

import (
	"strconv"
)

func formatFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
