#!/usr/bin/env bash

set -u

SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"

bash "$SCRIPT_DIR/Start-to-run.sh"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '\nGator Guide failed with exit code %s.\n' "$STATUS" >&2
  printf 'Press Enter to close this window...'
  IFS= read -r _
fi

exit "$STATUS"
