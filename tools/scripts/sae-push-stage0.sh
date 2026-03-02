#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  REGISTRY=<registry> REPO=<repo> [SHA=<sha>] [SOURCE_TAG=sae-check] bash tools/scripts/sae-push-stage0.sh

Required:
  REGISTRY    Target registry host (for example: crpi-xxx.cn-guangzhou.personal.cr.aliyuncs.com)
  REPO        Target repository path (for example: tmo_by_teamdsb/tmo)

Optional:
  SHA         Commit short SHA used in target tags; defaults to git rev-parse --short HEAD.
  SOURCE_TAG  Source local image tag; defaults to sae-check.
  SERVICES    Comma-separated service list; defaults to identity,commerce,payment,gateway-bff.
  PUSH_RETRIES Retry count for docker push; defaults to 3.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

registry="${REGISTRY:-}"
repo="${REPO:-}"
source_tag="${SOURCE_TAG:-sae-check}"
services_raw="${SERVICES:-identity,commerce,payment,gateway-bff}"
push_retries="${PUSH_RETRIES:-3}"

if [[ -z "${registry}" || -z "${repo}" ]]; then
  echo "[sae-push] REGISTRY and REPO are required." >&2
  usage
  exit 1
fi

sha="${SHA:-}"
if [[ -z "${sha}" ]]; then
  if ! sha="$(git rev-parse --short HEAD 2>/dev/null)"; then
    echo "[sae-push] unable to resolve SHA from git, please set SHA manually." >&2
    exit 1
  fi
fi

IFS=',' read -r -a services <<<"${services_raw}"

retry_push() {
  local image="$1"
  local attempt=1
  while (( attempt <= push_retries )); do
    if docker push "${image}"; then
      return 0
    fi
    if (( attempt == push_retries )); then
      return 1
    fi
    echo "[sae-push] retry push (${attempt}/${push_retries}) for ${image}" >&2
    sleep 2
    (( attempt += 1 ))
  done
}

declare -a pushed_images=()

for service in "${services[@]}"; do
  service="$(echo "${service}" | xargs)"
  if [[ -z "${service}" ]]; then
    continue
  fi

  src_image="tmo/${service}:${source_tag}"
  dst_image="${registry}/${repo}:${service}-${sha}"

  if ! docker image inspect "${src_image}" >/dev/null 2>&1; then
    echo "[sae-push] source image missing: ${src_image}" >&2
    exit 1
  fi

  echo "[sae-push] tagging ${src_image} -> ${dst_image}"
  docker tag "${src_image}" "${dst_image}"

  echo "[sae-push] pushing ${dst_image}"
  if ! retry_push "${dst_image}"; then
    echo "[sae-push] push failed: ${dst_image}" >&2
    exit 1
  fi

  pushed_images+=("${dst_image}")
done

echo "[sae-push] validating remote manifests..."
for image in "${pushed_images[@]}"; do
  if ! docker manifest inspect "${image}" >/dev/null 2>&1; then
    echo "[sae-push] remote manifest inspect failed: ${image}" >&2
    exit 1
  fi
  echo "[sae-push] verified ${image}"
done

echo "[sae-push] all images pushed successfully."
for image in "${pushed_images[@]}"; do
  echo "  - ${image}"
done

echo "[sae-push] migrate application mapping:"
echo "  - identity-migrate => ${registry}/${repo}:identity-${sha} with command /app/identity-migrate"
echo "  - commerce-migrate => ${registry}/${repo}:commerce-${sha} with command /app/commerce-migrate"
