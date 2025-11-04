#!/usr/bin/env bash
set -euo pipefail

# Guard that ensures CI image tag is immutable (non-latest) in GitHub CI.
# Under local act runs, be permissive to allow development without org vars.
# Usage: guard-ci-image-tag.sh [tag]

INPUT_TAG="${1:-}"
ENV_TAG="${CI_IMAGE_TAG:-}"

is_act_env() {
  if [[ "${ACT:-}" == "true" || "${IS_ACT:-}" == "true" ]]; then
    return 0
  fi
  case "${GITHUB_WORKSPACE:-}" in
    /github/*) return 0 ;;
  esac
  return 1
}

is_valid_immutable_tag() {
  local tag="$1"
  [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z]+)*$ ]] && return 0
  [[ "$tag" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9a-f]{7,40}$ ]] && return 0
  return 1
}

if is_act_env; then
  # In act, allow empty or dev-local/latest tags; print a note for visibility.
  if [[ -z "${INPUT_TAG}" && -z "${ENV_TAG}" ]]; then
    echo "Note: CI image tag not provided; allowed under act for local runs." >&2
    exit 0
  fi
  if [[ "${INPUT_TAG}" == "latest" || "${ENV_TAG}" == "latest" || "${INPUT_TAG}" == "dev-local" || "${ENV_TAG}" == "dev-local" ]]; then
    echo "Note: Using '${INPUT_TAG:-${ENV_TAG}}' tag under act; prefer immutable tag in CI." >&2
    exit 0
  fi
  if [[ -n "${INPUT_TAG}" ]]; then
    if ! is_valid_immutable_tag "${INPUT_TAG}"; then
      echo "Note: Non-immutable tag '${INPUT_TAG}' allowed under act; prefer immutable tag in CI." >&2
    fi
    exit 0
  fi
  if [[ -n "${ENV_TAG}" ]]; then
    if ! is_valid_immutable_tag "${ENV_TAG}"; then
      echo "Note: Non-immutable CI_IMAGE_TAG='${ENV_TAG}' allowed under act; prefer immutable tag in CI." >&2
    fi
    exit 0
  fi
fi

# GitHub CI enforcement (non-act):
if [[ -n "${INPUT_TAG}" ]]; then
  if [[ "${INPUT_TAG}" == "latest" ]]; then
    echo "ci_image_tag must not be 'latest'. Use an immutable tag (e.g., 2025.10.03-<sha> or vX.Y.Z)." >&2
    exit 1
  fi
  if ! is_valid_immutable_tag "${INPUT_TAG}"; then
    echo "ci_image_tag='${INPUT_TAG}' is not an accepted immutable tag. Use 'vMAJOR.MINOR.PATCH' or 'YYYY.MM.DD-<sha>'." >&2
    exit 1
  fi
  exit 0
fi

# No input tag; fallback to CI_IMAGE_TAG env var in GitHub CI
if [[ -z "${ENV_TAG}" ]]; then
  echo "ci_image_tag not provided and CI_IMAGE_TAG is unset. Set CI_IMAGE_TAG to an immutable tag in repo/org variables." >&2
  exit 1
fi
if [[ "${ENV_TAG}" == "latest" ]]; then
  echo "CI_IMAGE_TAG must not be 'latest'. Use an immutable tag (e.g., 2025.10.03-<sha> or vX.Y.Z)." >&2
  exit 1
fi
if ! is_valid_immutable_tag "${ENV_TAG}"; then
  echo "CI_IMAGE_TAG='${ENV_TAG}' is not an accepted immutable tag. Use 'vMAJOR.MINOR.PATCH' or 'YYYY.MM.DD-<sha>'." >&2
  exit 1
fi

echo "Using CI_IMAGE_TAG='${ENV_TAG}'." >&2
exit 0
