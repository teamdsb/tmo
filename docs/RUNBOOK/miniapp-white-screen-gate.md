# Miniapp White-Screen Quality Gate Runbook

## Scope

This runbook handles WeChat miniapp white-screen and startup API failures, especially:

- `/catalog/categories` returns `500`
- `/catalog/products` returns `500`
- startup API failures that only appeared after compile/import

## Fast Path (Local)

Run these commands in repository root:

```bash
bash tools/scripts/dev-stack-up.sh
bash tools/scripts/dev-stack-health.sh
pnpm -C apps/miniapp preflight:weapp
```

Expected:

- `dev-stack-health.sh` reports all checks passed.
- `preflight:weapp` exits `0` and writes `apps/miniapp/.logs/preflight/result.json`.

If `preflight:weapp` fails, continue with diagnosis.

## Diagnosis Flow

1. Check structured preflight result:

```bash
cat apps/miniapp/.logs/preflight/result.json
```

Focus on:

- `failedEndpoint`
- `statusCode`
- `requestId`
- `diagnoseSummary`

2. Run DB diagnosis directly:

```bash
bash tools/scripts/dev-diagnose-db.sh
```

3. If diagnosis indicates disk pressure / postgres recovery:

```bash
df -h
docker system df
docker builder prune -f
docker restart tmo-postgres
bash tools/scripts/dev-stack-health.sh
pnpm -C apps/miniapp preflight:weapp
```

4. If HTTP gate passes but runtime still looks wrong, run automator smoke:

```bash
pnpm -C apps/miniapp debug:weapp:smoke:standard
```

For release-grade strict checks:

```bash
pnpm -C apps/miniapp debug:weapp:smoke:strict
```

Print machine-readable automator verdict:

```bash
pnpm -C apps/miniapp debug:weapp:summary
```

## CI Interpretation

### `gateway-miniapp-ci`

- `fullstack-smoke`: normal quality gate.
- `preflight-fault-injection`: intentionally stops postgres; preflight must fail and print diagnosis.

If fault-injection job passes but fullstack fails:

- trust the failing endpoint/requestId from artifacts and debug service behavior.

### `weapp-automator-smoke`

- `quality_profile=standard`: network-first, low false positive.
- `quality_profile=strict`: includes render/image minimum assertions.

Artifacts:

- `apps/miniapp/.logs/preflight`
- `apps/miniapp/.logs/weapp`

Key file:

- `apps/miniapp/.logs/weapp/run.json` (single source of truth for status/firstFail/assertions in CI)

## Common Failure Signatures

1. `failed to list categories` or `failed to list products`
- Usually backend/db side.
- Check preflight `requestId`, then inspect gateway/commerce logs by request id.

2. `request blocked by domain whitelist (urlCheck)`
- Check wechat devtools local settings and project `urlCheck` behavior.

3. `api.example.com` appears in runtime/build logs
- Wrong build mode or missing API base config.
- Ensure development flow uses `build:weapp:dev` and `TARO_APP_API_BASE_URL`.

## Escalation

Escalate to backend owners when:

- `failedEndpoint` is stable and reproducible
- `requestId` is available
- DB diagnosis is clean but endpoint still returns `500`

Provide:

- `apps/miniapp/.logs/preflight/result.json`
- failing `summary.md` and `run.json` (if automator was used)
- backend container logs around matching `requestId`
