package errors_test

import (
	"fmt"
	"testing"

	apperr "improve-platform/pkg/errors"
)

var errSentinel = apperr.New("sentinel")

func TestE_NilReturnsNil(t *testing.T) {
	if got := apperr.E("Op", nil); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestE_WrapsError(t *testing.T) {
	err := apperr.E("Repo.Create", errSentinel)
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if got := err.Error(); got != "Repo.Create: sentinel" {
		t.Fatalf("unexpected message: %s", got)
	}
}

func TestE_NestedOps(t *testing.T) {
	inner := apperr.E("Repo.Find", errSentinel)
	outer := apperr.E("UseCase.Get", inner)

	want := "UseCase.Get: Repo.Find: sentinel"
	if got := outer.Error(); got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestIs_ThroughWrapping(t *testing.T) {
	inner := apperr.E("Repo.Find", errSentinel)
	outer := apperr.E("UseCase.Get", inner)

	if !apperr.Is(outer, errSentinel) {
		t.Fatal("errors.Is should find sentinel through wrapping")
	}
}

func TestAs_ThroughWrapping(t *testing.T) {
	base := fmt.Errorf("base: %w", errSentinel)
	wrapped := apperr.E("Repo.Op", base)

	var target *apperr.Error
	if !apperr.As(wrapped, &target) {
		t.Fatal("errors.As should find *apperr.Error")
	}
	if target.Op != "Repo.Op" {
		t.Fatalf("expected op Repo.Op, got %s", target.Op)
	}
}

func TestOps_ExtractsChain(t *testing.T) {
	err := apperr.E("Repo.Find", errSentinel)
	err = apperr.E("UseCase.Get", err)
	err = apperr.E("Handler.Get", err)

	ops := apperr.Ops(err)
	if len(ops) != 3 {
		t.Fatalf("expected 3 ops, got %d", len(ops))
	}
	expected := []apperr.Op{"Handler.Get", "UseCase.Get", "Repo.Find"}
	for i, want := range expected {
		if ops[i] != want {
			t.Errorf("ops[%d] = %q, want %q", i, ops[i], want)
		}
	}
}

func TestOps_PlainError(t *testing.T) {
	ops := apperr.Ops(errSentinel)
	if len(ops) != 0 {
		t.Fatalf("expected 0 ops for plain error, got %d", len(ops))
	}
}

func TestOps_Nil(t *testing.T) {
	ops := apperr.Ops(nil)
	if len(ops) != 0 {
		t.Fatalf("expected 0 ops for nil, got %d", len(ops))
	}
}

func TestOpsTrace(t *testing.T) {
	err := apperr.E("Repo.Find", errSentinel)
	err = apperr.E("UseCase.Get", err)

	want := "UseCase.Get > Repo.Find"
	if got := apperr.OpsTrace(err); got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestOpsTrace_Empty(t *testing.T) {
	if got := apperr.OpsTrace(errSentinel); got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
}

func TestRootCause(t *testing.T) {
	err := apperr.E("Repo.Find", errSentinel)
	err = apperr.E("UseCase.Get", err)

	root := apperr.RootCause(err)
	if root != errSentinel {
		t.Fatalf("expected sentinel, got %v", root)
	}
}

func TestRootCause_PlainError(t *testing.T) {
	root := apperr.RootCause(errSentinel)
	if root != errSentinel {
		t.Fatalf("expected sentinel, got %v", root)
	}
}

func TestError_EmptyOp(t *testing.T) {
	err := apperr.E("", errSentinel)
	if got := err.Error(); got != "sentinel" {
		t.Fatalf("expected %q, got %q", "sentinel", got)
	}
}
