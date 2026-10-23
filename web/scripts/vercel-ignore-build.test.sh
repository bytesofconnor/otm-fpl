#!/usr/bin/env bash
set -euo pipefail

script=$(cd "$(dirname "$0")" && pwd)/vercel-ignore-build.sh
fail=0
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT

init_repo() {
  local repo=$1
  mkdir -p "$repo"
  git -C "$repo" init -q -b main
  git -C "$repo" config user.email test@example.com
  git -C "$repo" config user.name test
}

commit_all() {
  local repo=$1
  local msg=$2
  git -C "$repo" add -A
  git -C "$repo" commit -q -m "$msg"
}

check() {
  local name=$1
  local dir=$2
  local want=$3
  shift 3
  local code=0
  local out
  out=$(
    cd "$dir" && env -i PATH="$PATH" HOME="$HOME" "$@" "$script" 2>&1
  ) || code=$?
  if [[ "$code" -ne "$want" ]]; then
    echo "FAIL ${name}: exit ${code}, expected ${want}" >&2
    printf '%s\n' "$out" >&2
    fail=1
    return
  fi
  echo "PASS ${name}"
}

web_change="$root/web-change"
init_repo "$web_change"
mkdir -p "$web_change/web"
echo base > "$web_change/web/app.txt"
commit_all "$web_change" base
echo next > "$web_change/web/app.txt"
commit_all "$web_change" "change web"

check main-web-builds "$web_change/web" 1 \
  VERCEL_ENV=production \
  VERCEL_GIT_COMMIT_REF=main

check dependabot-preview-skips "$web_change/web" 0 \
  VERCEL_ENV=preview \
  VERCEL_GIT_COMMIT_REF=dependabot/npm_and_yarn/web/example

check cursor-preview-skips "$web_change/web" 0 \
  VERCEL_ENV=preview \
  VERCEL_GIT_COMMIT_REF=cursor/example-0e9d

check production-dependabot-web-builds "$web_change/web" 1 \
  VERCEL_ENV=production \
  VERCEL_GIT_COMMIT_REF=dependabot/npm_and_yarn/web/example

github_only="$root/github-only"
init_repo "$github_only"
mkdir -p "$github_only/web" "$github_only/.github"
echo app > "$github_only/web/app.txt"
echo workflow > "$github_only/.github/ci.yml"
commit_all "$github_only" base
echo workflow2 > "$github_only/.github/ci.yml"
commit_all "$github_only" "change github"

check main-github-only-skips "$github_only/web" 0 \
  VERCEL_ENV=production \
  VERCEL_GIT_COMMIT_REF=main

missing_parent="$root/missing-parent"
init_repo "$missing_parent"
mkdir -p "$missing_parent/web"
echo only > "$missing_parent/web/app.txt"
commit_all "$missing_parent" only

check missing-parent-builds "$missing_parent/web" 1 \
  VERCEL_ENV=production \
  VERCEL_GIT_COMMIT_REF=main

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
