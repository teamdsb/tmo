#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  REGISTRY=<registry> REPO=<repo> [SHA=<sha>] bash tools/scripts/sae-image-preflight.sh

Required:
  REGISTRY    Registry host (for example: crpi-xxx.cn-guangzhou.personal.cr.aliyuncs.com)
  REPO        Repository path (for example: tmo_by_teamdsb/tmo)

Optional:
  SHA         Commit short SHA used in tags; defaults to git rev-parse --short HEAD.
  SERVICES    Comma-separated service list; defaults to identity,commerce,payment,gateway-bff.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

registry="${REGISTRY:-}"
repo="${REPO:-}"
services_raw="${SERVICES:-identity,commerce,payment,gateway-bff}"

if [[ -z "${registry}" || -z "${repo}" ]]; then
  echo "[sae-preflight] REGISTRY and REPO are required." >&2
  usage
  exit 1
fi

sha="${SHA:-}"
if [[ -z "${sha}" ]]; then
  if ! sha="$(git rev-parse --short HEAD 2>/dev/null)"; then
    echo "[sae-preflight] unable to resolve SHA from git, please set SHA manually." >&2
    exit 1
  fi
fi

IFS=',' read -r -a services <<<"${services_raw}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

assert_remote_manifest() {
  local image="$1"
  if ! docker manifest inspect "${image}" >/dev/null 2>&1; then
    echo "[sae-preflight] FAIL manifest inspect: ${image}" >&2
    return 1
  fi
  echo "[sae-preflight] PASS manifest inspect: ${image}"
}

assert_image_path() {
  local image="$1"
  local path="$2"
  local target
  local cid
  target="${tmp_dir}/$(echo "${path}" | tr '/' '_')_$$"

  if ! cid="$(docker create "${image}")"; then
    echo "[sae-preflight] FAIL create container from image: ${image}" >&2
    return 1
  fi

  if ! docker cp "${cid}:${path}" "${target}" >/dev/null 2>&1; then
    docker rm "${cid}" >/dev/null 2>&1 || true
    echo "[sae-preflight] FAIL missing path ${path} in ${image}" >&2
    return 1
  fi

  docker rm "${cid}" >/dev/null 2>&1 || true
  rm -rf "${target}"
  echo "[sae-preflight] PASS image path: ${image} -> ${path}"
}

for service in "${services[@]}"; do
  service="$(echo "${service}" | xargs)"
  if [[ -z "${service}" ]]; then
    continue
  fi

  image="${registry}/${repo}:${service}-${sha}"
  assert_remote_manifest "${image}"

  case "${service}" in
    gateway-bff)
      assert_image_path "${image}" "/app/gateway-bff"
      ;;
    identity|commerce|payment)
      assert_image_path "${image}" "/app/${service}"
      ;;
    *)
      echo "[sae-preflight] WARN unknown service ${service}, skipping path checks."
      ;;
  esac

  if [[ "${service}" == "identity" || "${service}" == "commerce" ]]; then
    assert_image_path "${image}" "/app/${service}-migrate"
    assert_image_path "${image}" "/app/migrations"
  fi
done

echo "[sae-preflight] all checks passed."
