#!/bin/sh

set -eu

if [ "$#" -eq 0 ]; then
    set -- up
fi

case "$1" in
    down|goto|force|drop)
        if [ "${MIGRATIONS_ALLOW_DESTRUCTIVE:-false}" != "true" ]; then
            echo "Refusing destructive migration command '$1' without MIGRATIONS_ALLOW_DESTRUCTIVE=true." >&2
            exit 64
        fi
        ;;
esac

status=0
output="$(migrate -path=/migrations -database="$MIGRATIONS_DATABASE_URL" "$@" 2>&1)" || status=$?

printf '%s\n' "$output"

if [ "$status" -eq 0 ]; then
    exit 0
fi

if printf '%s\n' "$output" | grep -qi "no change"; then
    exit 0
fi

exit "$status"
