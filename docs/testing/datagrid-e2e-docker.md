# Local DataGrid e2e in Docker

The repository provides a reproducible Chromium runner for the Playwright suite. It is useful on ARM64 development hosts where Playwright cannot install a native Chromium binary.

From the repository root, run:

```bash
pnpm run test:e2e:docker
```

The runner uses the pinned Playwright `v1.58.2-noble` image and forces `linux/amd64`. Docker Desktop, Docker Engine with the `linux/amd64` platform, or an equivalent container runtime is required. The first run downloads the image and installs dependencies into named Docker volumes.

To run a focused test, invoke the compose service directly:

```bash
docker compose -f docker-compose.e2e.yml run --rm e2e \
  bash -lc 'corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright test e2e/sandbox-grid.spec.ts --grep "bounded window"'
```

The source tree is mounted into the container. `e2e_node_modules` and `e2e_pnpm_store` keep container dependencies separate from host dependencies.
