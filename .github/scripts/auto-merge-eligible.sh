#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${AUTO_MERGE_HEAD_REPO:-}" || -z "${AUTO_MERGE_BASE_REPO:-}" ]]; then
  echo "AUTO_MERGE_HEAD_REPO and AUTO_MERGE_BASE_REPO are required." >&2
  exit 1
fi

if [[ "$AUTO_MERGE_HEAD_REPO" != "$AUTO_MERGE_BASE_REPO" ]]; then
  echo "skip: fork"
  exit 2
fi

echo "eligible: same-repo"
exit 0
