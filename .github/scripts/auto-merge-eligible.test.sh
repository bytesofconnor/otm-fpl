#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
script="$root/.github/scripts/auto-merge-eligible.sh"
fail=0

run() {
  local name=$1 expect=$2
  shift 2
  local out code
  out=$(env "$@" "$script" 2>&1) && code=0 || code=$?
  if [[ "$code" != "$expect" ]]; then
    echo "FAIL ${name}: exit ${code}, expected ${expect}" >&2
    printf '%s\n' "$out" >&2
    fail=1
    return
  fi
  echo "PASS ${name}"
}

base=(
  AUTO_MERGE_HEAD_REPO=bytesofconnor/otm-fpl
  AUTO_MERGE_BASE_REPO=bytesofconnor/otm-fpl
)

run missing-env 1

run fork 2 \
  AUTO_MERGE_HEAD_REPO=someone/otm-fpl \
  AUTO_MERGE_BASE_REPO=bytesofconnor/otm-fpl

run github-workflow 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=cursor/ok-0e9d \
  AUTO_MERGE_AUTHOR=bytesofconnor \
  AUTO_MERGE_FILES=$'.github/workflows/ci.yml\nweb/package.json'

run cursor-rules 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=cursor/ok-0e9d \
  AUTO_MERGE_AUTHOR=bytesofconnor \
  AUTO_MERGE_FILES=.cursor/rules/pstack-models.mdc

run agents-md 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=cursor/ok-0e9d \
  AUTO_MERGE_AUTHOR=bytesofconnor \
  AUTO_MERGE_FILES=AGENTS.md

run other-branch 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=feature/ok \
  AUTO_MERGE_AUTHOR=bytesofconnor \
  AUTO_MERGE_FILES=web/package.json

run dependabot-major 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=dependabot/npm_and_yarn/web/foo-2.0.0 \
  AUTO_MERGE_AUTHOR='dependabot[bot]' \
  AUTO_MERGE_UPDATE_TYPE=version-update:semver-major \
  AUTO_MERGE_FILES=web/package-lock.json

run dependabot-unknown 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=dependabot/npm_and_yarn/web/foo \
  AUTO_MERGE_AUTHOR='dependabot[bot]' \
  AUTO_MERGE_FILES=web/package-lock.json

run cursor-ok 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=cursor/ok-0e9d \
  AUTO_MERGE_AUTHOR=bytesofconnor \
  AUTO_MERGE_FILES=$'web/src/app/page.tsx\nREADME.md'

run dependabot-patch 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=dependabot/npm_and_yarn/web/foo-1.2.4 \
  AUTO_MERGE_AUTHOR='dependabot[bot]' \
  AUTO_MERGE_UPDATE_TYPE=version-update:semver-patch \
  AUTO_MERGE_FILES=web/package-lock.json

run dependabot-minor 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=dependabot/npm_and_yarn/web/foo-1.3.0 \
  AUTO_MERGE_AUTHOR='dependabot[bot]' \
  AUTO_MERGE_UPDATE_TYPE=version-update:semver-minor \
  AUTO_MERGE_FILES=web/package.json

run dependabot-actions 0 \
  "${base[@]}" \
  AUTO_MERGE_HEAD_REF=dependabot/github_actions/actions/checkout-5.0.0 \
  AUTO_MERGE_AUTHOR='dependabot[bot]' \
  AUTO_MERGE_FILES=.github/workflows/ci.yml

if [[ "$fail" -ne 0 ]]; then
  echo "auto-merge eligibility tests failed." >&2
  exit 1
fi

echo "All auto-merge eligibility tests passed."
