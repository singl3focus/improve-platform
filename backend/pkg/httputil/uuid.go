package httputil

import (
	"net/http"
	"regexp"

	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidateUUID checks that value is a valid UUID v4 string.
// On failure it writes a 400 response and returns false.
func ValidateUUID(w http.ResponseWriter, value, field string) bool {
	if !uuidPattern.MatchString(value) {
		httpresp.Error(w, http.StatusBadRequest, "validation_error", field+" must be a valid UUID")
		return false
	}
	return true
}
