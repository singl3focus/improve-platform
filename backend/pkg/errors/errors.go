package errors

import (
	"errors"
	"fmt"
	"strings"
)

// Op identifies the operation (e.g. "UserRepo.FindByEmail", "UseCase.Login").
type Op string

// Error is a layered error that carries an operation name and wraps an inner error.
// It preserves errors.Is / errors.As semantics through Unwrap.
type Error struct {
	Op  Op
	Err error
}

// E wraps err with the given operation name.
// Returns nil when err is nil so callers can write: return apperr.E(op, err)
func E(op Op, err error) error {
	if err == nil {
		return nil
	}
	return &Error{Op: op, Err: err}
}

func (e *Error) Error() string {
	if e.Op == "" {
		return e.Err.Error()
	}
	return string(e.Op) + ": " + e.Err.Error()
}

func (e *Error) Unwrap() error {
	return e.Err
}

// Ops extracts the ordered chain of operation names from a nested Error.
// The outermost op comes first.
func Ops(err error) []Op {
	var ops []Op
	for err != nil {
		var e *Error
		if !errors.As(err, &e) {
			break
		}
		if e.Op != "" {
			ops = append(ops, e.Op)
		}
		err = e.Err
	}
	return ops
}

// OpsTrace returns a human-readable "op1 > op2 > op3" trace string.
func OpsTrace(err error) string {
	ops := Ops(err)
	if len(ops) == 0 {
		return ""
	}
	parts := make([]string, len(ops))
	for i, o := range ops {
		parts[i] = string(o)
	}
	return strings.Join(parts, " > ")
}

// RootCause returns the deepest non-Error error in the chain.
func RootCause(err error) error {
	for {
		var e *Error
		if !errors.As(err, &e) {
			return err
		}
		if e.Err == nil {
			return err
		}
		err = e.Err
	}
}

// Re-export standard library helpers so callers can use a single import.
var (
	Is  = errors.Is
	As  = errors.As
	New = errors.New
)

// Unwrap delegates to the standard library.
func Unwrap(err error) error { return errors.Unwrap(err) }

// Fmt is a convenience for fmt.Errorf with %w.
func Fmt(format string, a ...any) error { return fmt.Errorf(format, a...) }
