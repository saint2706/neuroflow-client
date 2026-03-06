# Cross-Platform Compatibility Audit (Electron)

Date: 2026-03-06  
Repository: `neuroflow-client`

## Scope

Audit focus:
- Build + packaging feasibility for Linux, Windows, and macOS.
- Runtime portability issues in Electron main/preload process code.
- Config issues that can break packaging or produce platform-specific behavior.

## Tooling installed / used

- `npm ci` (installed project dependencies including Electron + electron-builder)
- `npm run lint`
- `npm run build`
- `npx electron-builder --linux --dir`
- `npx electron-builder --win --dir`
- `npx electron-builder --mac --dir`

## High-level result

The app can build and package Linux/macOS directory artifacts from this environment, but there are multiple portability gaps that will block or degrade real cross-platform distribution:

1. **Packaged backend executable path is incorrect in Electron main process** (high risk runtime failure on all OSes).  
2. **`extraResources` path points outside repo and is currently missing** (high risk missing backend in packaged artifacts).  
3. **Windows packaging from Linux fails due missing Wine/NSIS chain** (environment/tooling gap).  
4. **macOS-specific title bar style is applied unconditionally** (UI behavior inconsistency on non-macOS).  
5. **Renderer build injects full `process.env`** (security and portability concern across environments).

---

## Detailed findings

### 1) Backend executable launch path is not platform-safe

**Evidence**
- `electron/main.js` computes `backendName` but does not use it.
- Spawn path is set to `path.join(process.resourcesPath, 'neuroflow-backend')`, which is a directory path (or resource folder), not the binary file path.

**Impact**
- In packaged mode, backend process launch can fail on Linux/macOS/Windows because `spawn()` may target a directory/non-executable path.

**Actionable fix**
- Build full executable path with platform-specific filename and extension:
  - `${process.resourcesPath}/neuroflow-backend/neuroflow-backend(.exe on win32)`.
- Verify executable permissions for Linux/macOS (`chmod +x` during packaging pipeline).

---

### 2) Packaged backend resource source is missing

**Evidence**
- `package.json` uses:
  - `extraResources.from = ../neuroflow-logic/dist/neuroflow-backend`
- Electron builder logs report: `file source doesn't exist` for that path during linux/win/mac packaging.

**Impact**
- Packaged app likely ships without backend, causing runtime API failures.
- Fragile CI because packaging depends on sibling repo state, not local project artifacts.

**Actionable fix**
- Move backend build artifact creation into this repo's build pipeline or explicit prebuild step.
- Fail CI hard when backend resource is missing (custom script precheck before `electron-builder`).
- Consider versioned artifact ingestion (download/release asset) instead of relative `../` path coupling.

---

### 3) Windows packaging requires extra host tooling when building on Linux

**Evidence**
- `npx electron-builder --win --dir` failed with: `wine is required`.

**Impact**
- Cross-building Windows distributables from Linux CI is currently blocked without Wine + required toolchain.

**Actionable fix**
- Choose one:
  1. Build Windows artifacts on native Windows CI runners (recommended).
  2. Install/configure Wine + mono + NSIS in Linux CI image.
- Add CI matrix explicitly by OS (`ubuntu-latest`, `windows-latest`, `macos-latest`) to avoid hidden host assumptions.

---

### 4) macOS-only title bar style used for all platforms

**Evidence**
- `BrowserWindow` option `titleBarStyle: 'hiddenInset'` is set unconditionally.

**Impact**
- Potentially ignored or inconsistent behavior on Windows/Linux; can cause UX divergence and testing noise.

**Actionable fix**
- Gate window style by platform:
  - macOS: `hiddenInset`
  - Windows/Linux: standard frame or tested alternatives (`hidden`, `customButtonsOnHover`, etc.).

---

### 5) Full env object is injected into renderer bundle

**Evidence**
- Vite warns that full `process.env` object is passed to `define`.
- `vite.config.ts` and `vite.config.js` both define `'process.env': env`.

**Impact**
- Security risk (exposing host env vars in renderer bundle).
- Inconsistent runtime behavior across OS/CI because injected env depends on build host.

**Actionable fix**
- Replace with explicit allowlist injection, e.g. `import.meta.env.VITE_*` only.
- Remove duplicate config file or define a single source of truth.

---

## Additional observations

- Lint currently fails with Node global issues (`process`, `require`) in config/electron files due ESLint environment settings, and with unused vars.
- Build emits warnings (duplicate object keys, `eval` usage in renderer code, oversized chunks) that are not strictly platform blockers but should be tracked for stability/security/performance.

## Prioritized remediation backlog

### P0 (release blocking)
1. Fix backend executable path construction in `electron/main.js` and add startup error dialog when spawn fails.
2. Make backend resource availability deterministic (`extraResources` precheck + CI failure).
3. Establish OS-specific build jobs in CI and publish artifacts per host platform.

### P1 (strongly recommended)
4. Platform-gate BrowserWindow title bar config.
5. Remove full `process.env` injection; use explicit env keys.
6. Resolve lint config for Node/Electron files (`env: node` or flat-config `globals` scope).

### P2 (quality hardening)
7. Remove duplicate keys in node result payloads in renderer components.
8. Replace `eval`-based filter evaluation with a safe expression parser.
9. Reduce bundle size and chunk warnings with code splitting/manual chunks.

## Suggested acceptance checks after fixes

- `npm run lint` passes cleanly.
- `npm run build` has no security warnings about `process.env` or `eval`.
- `npx electron-builder --linux --dir` includes backend binary under unpacked resources and app can launch backend.
- Windows artifact built on Windows runner; macOS artifact built on macOS runner.
- Smoke test: save/load project dialog works on each OS.
