#!/usr/bin/env bash
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"
target="${VERCEL_ENV:-}"

if [[ "$target" == preview && ( "$ref" == dependabot/* || "$ref" == cursor/* ) ]]; then
  echo "skip: preview bot branch"
  exit 0
fi

if ! git rev-parse --verify --quiet 'HEAD^' >/dev/null 2>&1; then
  echo "build: missing parent"
  exit 1
fi

set +e
git diff --quiet HEAD^ HEAD -- .
code=$?
set -e

if [[ "$code" -eq 0 ]]; then
  echo "skip: no changes under web"
  exit 0
fi

if [[ "$code" -eq 1 ]]; then
  echo "build: web changed"
  exit 1
fi

echo "build: git diff exited ${code}" >&2
exit 1
