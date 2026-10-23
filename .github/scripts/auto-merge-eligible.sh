#!/usr/bin/env bash
set -euo pipefail

skip() {
  printf '%s\n' "$1"
  exit 2
}

if [[ -z "${AUTO_MERGE_HEAD_REF:-}" || -z "${AUTO_MERGE_HEAD_REPO:-}" || -z "${AUTO_MERGE_BASE_REPO:-}" || -z "${AUTO_MERGE_AUTHOR:-}" ]]; then
  echo "AUTO_MERGE_HEAD_REF, AUTO_MERGE_HEAD_REPO, AUTO_MERGE_BASE_REPO, and AUTO_MERGE_AUTHOR are required." >&2
  exit 1
fi

if [[ "$AUTO_MERGE_HEAD_REPO" != "$AUTO_MERGE_BASE_REPO" ]]; then
  skip "skip: fork"
fi

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    .github|.github/*|.cursor/rules|.cursor/rules/*|AGENTS.md)
      skip "skip: protected path ${path}"
      ;;
  esac
done <<< "${AUTO_MERGE_FILES:-}"

if [[ "$AUTO_MERGE_AUTHOR" == "dependabot[bot]" ]]; then
  case "${AUTO_MERGE_UPDATE_TYPE:-}" in
    version-update:semver-patch|version-update:semver-minor)
      echo "eligible: dependabot ${AUTO_MERGE_UPDATE_TYPE}"
      exit 0
      ;;
    version-update:semver-major)
      skip "skip: dependabot major"
      ;;
    *)
      skip "skip: dependabot update-type ${AUTO_MERGE_UPDATE_TYPE:-unknown}"
      ;;
  esac
fi

if [[ "$AUTO_MERGE_HEAD_REF" == cursor/* ]]; then
  echo "eligible: cursor branch"
  exit 0
fi

skip "skip: not a same-repo cursor/* branch or a Dependabot patch or minor"
