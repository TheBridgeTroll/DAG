#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Persistent dev service: subsequent builds replace the same container.
# Allow only one concurrent TeamCity build of this configuration.
compose() { docker compose -p dag-devgui -f compose.yaml "$@"; }
cleanup() {
  result=$?
  trap - EXIT
  # Only untagged images bearing this application's label; never global -a/system prune.
  docker image prune -f --filter 'label=pl.dag.component=devgui' || true
  exit "$result"
}
trap cleanup EXIT
compose config --quiet
compose build
compose up -d --wait --wait-timeout 120 --remove-orphans
compose exec -T gui node scripts/healthcheck.mjs
compose ps
