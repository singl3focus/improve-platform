package httpresp_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"improve-platform/pkg/httpresp"
)

func TestJSON_SetsContentTypeAndStatus(t *testing.T) {
	rec := httptest.NewRecorder()
	data := map[string]string{"key": "value"}

	httpresp.JSON(rec, http.StatusOK, data)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}

	var result map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result["key"] != "value" {
		t.Errorf("expected key=value, got key=%s", result["key"])
	}
}

func TestError_ReturnsUnifiedFormat(t *testing.T) {
	rec := httptest.NewRecorder()

	httpresp.Error(rec, http.StatusBadRequest, "bad_request", "something went wrong")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}

	var result httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result.Error.Code != "bad_request" {
		t.Errorf("expected code bad_request, got %s", result.Error.Code)
	}
	if result.Error.Message != "something went wrong" {
		t.Errorf("expected message 'something went wrong', got %s", result.Error.Message)
	}
}
