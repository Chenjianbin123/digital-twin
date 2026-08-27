# Digital Twin SWP Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nurse-station styled login gate that authenticates through SWP, requires role confirmation, and uses the SWP TokenKey request protocol before real ward data loads.

**Architecture:** Keep the router-free application and place authentication at the root `App.vue` boundary. Isolate session persistence, authentication API calls, and the login UI; extend the existing HTTP client to inject the current session token and invalidate the session on 401/403.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, native fetch, `js-md5`, Node test runner.

## Global Constraints

- Use `POST /swp/system/sysUser/login` with `userName` and MD5 `userPassword`.
- Use `POST /swp/system/sysUser/roleConfirm` before mounting the digital twin.
- Store the active token in `sessionStorage.TokenKey` and send it in the `token` header.
- Do not persist plaintext passwords or the entire Pinia state.
- Do not initialize ward/device data before authentication and role confirmation.
- Keep existing 3D model, camera, panels, and ward workflows unchanged.
- Switch development data source to `remote`.

---

### Task 1: Authentication Session Contract

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/core/auth-session.ts`
- Test: `scripts/auth-session.test.ts`

**Interfaces:**
- Produces: `AuthRole`, `AuthUser`, `AuthSession`, `readAuthSession()`, `writePendingAuth()`, `confirmAuthRole()`, `clearAuthSession()`, `getSessionToken()` and `AUTH_EXPIRED_EVENT`.

- [ ] **Step 1: Write the failing session test**

Test a memory-backed `Storage` implementation: an empty store is unauthenticated, `writePendingAuth()` writes `TokenKey` but no confirmed session, `confirmAuthRole()` makes `readAuthSession()` return the selected role, and `clearAuthSession()` removes all authentication keys.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test scripts/auth-session.test.ts`

Expected: FAIL because `src/core/auth-session.ts` does not exist.

- [ ] **Step 3: Implement the minimal session module**

Use the exact keys `TokenKey`, `DIGITAL_TWIN_AUTH_USER`, and `DIGITAL_TWIN_AUTH_ROLE`. All functions accept an optional `Storage` argument so the behavior is testable without a browser. Parse malformed JSON as no session and clear stale role data when writing a new pending login.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test scripts/auth-session.test.ts`

Expected: PASS with no failures.

### Task 2: SWP Authentication API and HTTP Token Lifecycle

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/api/auth.ts`
- Modify: `src/api/http-client.ts`
- Modify: `src/utils/device-cache.ts`
- Test: `scripts/auth-api-boundary.test.mjs`

**Interfaces:**
- Consumes: `getSessionToken()`, `clearAuthSession()`, `AUTH_EXPIRED_EVENT`.
- Produces: `createLoginPayload(userName, password)`, `loginSwpUser(credentials)`, `confirmSwpRole(roleId, token)` and `postJson(..., { auth: 'omit' | 'auto' })`.

- [ ] **Step 1: Write the failing API boundary test**

Assert that `auth.ts` uses `js-md5`, calls `system/sysUser/login` with `auth: 'omit'`, calls `system/sysUser/roleConfirm`, and that `http-client.ts` injects `token`, handles HTTP and business-code 401/403, clears the session and dispatches `AUTH_EXPIRED_EVENT`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test scripts/auth-api-boundary.test.mjs`

Expected: FAIL because the authentication API does not exist.

- [ ] **Step 3: Add `js-md5` and implement API calls**

Install the same `js-md5` package used by `swp-admin`. Define typed login responses and role confirmation. Login omits the auth header; role confirmation uses the token just written by `writePendingAuth()`.

- [ ] **Step 4: Extend the HTTP client**

Add `auth?: 'auto' | 'omit'` to `PostJsonOptions`. Resolve the token from `sessionStorage.TokenKey` first, then the legacy environment token. On 401/403, clear session data, dispatch the expiration event once, and throw `ApiError` without exposing token values.

- [ ] **Step 5: Run test and verify GREEN**

Run: `node --test scripts/auth-api-boundary.test.mjs scripts/auth-session.test.ts`

Expected: both tests PASS.

### Task 3: Login Gate and Role Confirmation UI

**Files:**
- Create: `src/components/SwpLoginGate.vue`
- Test: `scripts/login-gate-boundary.test.mjs`

**Interfaces:**
- Consumes: `loginSwpUser()`, `confirmSwpRole()`, `writePendingAuth()`, `confirmAuthRole()`, `readAuthSession()`.
- Produces: Vue event `authenticated: [session: AuthSession]`.

- [ ] **Step 1: Write the failing UI boundary test**

Assert that the component uses `/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp`, renders account/password fields, password visibility control, loading/error states, a separate role selection step, and emits only after `confirmSwpRole()` succeeds.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test scripts/login-gate-boundary.test.mjs`

Expected: FAIL because `SwpLoginGate.vue` does not exist.

- [ ] **Step 3: Implement the desktop login rail**

Build the selected full-screen nurse-station design with a full-height right access rail, restrained cyan status accents, accessible form labels, password toggle, disabled loading button and non-sensitive errors.

- [ ] **Step 4: Implement role confirmation and responsive layout**

After login, replace the form with the returned roles. Require an explicit selection even for one role, call role confirmation, persist the selected role, then emit `authenticated`. At widths below the existing medium breakpoint, use a full-width lower access region and prevent text or controls from overflowing.

- [ ] **Step 5: Run test and verify GREEN**

Run: `node --test scripts/login-gate-boundary.test.mjs`

Expected: PASS.

### Task 4: Root Authentication Boundary and Logout

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/dashboard/DashboardHeader.vue`
- Modify: `.env.development`
- Test: `scripts/app-auth-boundary.test.mjs`

**Interfaces:**
- Consumes: `SwpLoginGate`, `readAuthSession()`, `clearAuthSession()`, `AUTH_EXPIRED_EVENT`.
- Produces: authenticated-only application bootstrap and a header logout command.

- [ ] **Step 1: Write the failing application boundary test**

Assert that `App.vue` renders the login gate while unauthenticated, does not call the existing area bootstrap until authentication, handles the expiration event, and clears auth before logout. Assert that `.env.development` uses `VITE_DATA_SOURCE=remote`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test scripts/app-auth-boundary.test.mjs`

Expected: FAIL because the root app has no authentication boundary.

- [ ] **Step 3: Gate application bootstrap**

Extract the existing mounted bootstrap body into an idempotent `bootstrapDigitalTwin()` function. Register the session-expiration listener on mount, call bootstrap only for a confirmed session, and invoke it after the login gate emits `authenticated`.

- [ ] **Step 4: Add logout and remote configuration**

Add a clear logout icon/button in `DashboardHeader`, stop runtime services through page reload after session cleanup, and change `.env.development` to `VITE_DATA_SOURCE=remote`.

- [ ] **Step 5: Run test and verify GREEN**

Run: `node --test scripts/app-auth-boundary.test.mjs scripts/login-gate-boundary.test.mjs scripts/auth-api-boundary.test.mjs scripts/auth-session.test.ts`

Expected: all authentication tests PASS.

### Task 5: Regression and Visual Verification

**Files:**
- Modify only files required by defects discovered during verification.

**Interfaces:**
- Consumes: completed authentication and existing digital twin workflows.
- Produces: verified production build and desktop/mobile login experience.

- [ ] **Step 1: Run focused and existing regression tests**

Run: `node --test scripts/auth-session.test.ts scripts/auth-api-boundary.test.mjs scripts/login-gate-boundary.test.mjs scripts/app-auth-boundary.test.mjs scripts/nurse-station-scene-boundary.test.mjs scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: `vue-tsc --noEmit` and Vite build exit with code 0.

- [ ] **Step 3: Verify in the browser**

Check desktop `1280x720` and mobile `390x844`: login background renders, fields do not overlap, keyboard focus is visible, password toggle works, role confirmation remains gated, invalid login errors are readable, and no ward API request occurs before successful role confirmation.

- [ ] **Step 4: Verify session lifecycle**

Confirm refresh preserves a confirmed session, logout returns to login, and a simulated 401/403 clears `TokenKey` and returns to the login gate.
