# Database Auth And Area Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticate existing platform users through `dnk_swp_db`, confirm their roles, and restrict database-backed ward data to the selected role's authorized areas.

**Architecture:** A standalone server authentication module owns signed tokens and authorization helpers. The database adapter supplies parameterized queries and protects its business routes; the frontend selects remote or database authentication from the configured data source while preserving the existing login UI and session model.

**Tech Stack:** Node.js, `node:crypto`, `mysql2`, Vue 3, TypeScript, Pinia, Node test runner

## Global Constraints

- Do not create or modify users, roles, role assignments, area permissions, calls, alarms, or patient records.
- Never expose MySQL credentials, password hashes, authorization tokens, phone numbers, ID cards, or patient identities in logs or responses.
- Preserve existing `remote` and `mock` behavior.
- Database mode must not fall back to another data source when authentication or data loading fails.
- Keep patient name masking enabled by default.

---

### Task 1: Signed database sessions

**Files:**
- Create: `server/db-auth.mjs`
- Create: `scripts/db-auth.test.mjs`

**Interfaces:**
- Produces: `createDbAuth({ secret, sessionTtlSeconds, pendingTtlSeconds, now })`
- Produces: `signPending(userId)`, `signSession(userId, roleId)`, `verifyPending(token)`, `verifySession(token)`

- [ ] Write tests covering valid pending/session tokens, expiry, wrong token type, and tampering.
- [ ] Run `node --test scripts/db-auth.test.mjs` and observe the missing-module failure.
- [ ] Implement URL-safe HMAC-SHA256 tokens with constant-time signature comparison.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Database login and role authorization

**Files:**
- Create: `server/db-auth-service.mjs`
- Create: `scripts/db-auth-service.test.mjs`
- Modify: `server/db-adapter.mjs`

**Interfaces:**
- Consumes: parameterized `query(sql, params)` and `createDbAuth()`.
- Produces: `createDbAuthService({ query, auth })` with `login`, `confirmRole`, `listAuthorizedAreas`, `assertAreaAccess`.
- Produces HTTP routes `POST /auth/login` and `POST /auth/role-confirm`.

- [ ] Write query-injection tests for successful login, generic invalid credentials, disabled accounts, empty roles, valid role confirmation, role mismatch, filtered area list, and denied area access.
- [ ] Run the focused service test and observe the missing-module failure.
- [ ] Implement the service using parameterized SQL, minimal response fields, MD5 constant-time comparison, and role-area joins.
- [ ] Protect database business routes with bearer-session verification and role area checks.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Frontend database authentication

**Files:**
- Modify: `src/api/auth.ts`
- Modify: `src/api/database-twin.ts`
- Modify: `src/components/SwpLoginGate.vue`
- Modify: `src/core/auth-session.ts`
- Modify: `src/types/auth.ts`
- Modify: `.env.development`
- Modify: `.env.db-adapter.example`
- Modify: `scripts/auth-api-boundary.test.mjs`
- Modify: `scripts/app-auth-boundary.test.mjs`
- Modify: `scripts/auth-session.test.ts`

**Interfaces:**
- `confirmSwpRole(roleId, token): Promise<string | undefined>` returns a replacement database session token when supplied.
- `replacePendingAuthToken(token)` updates both `TokenKey` and the persisted `AuthUser.token`.
- Database JSON requests attach `Authorization: Bearer <TokenKey>` and expire the local session on 401/403.

- [ ] Update frontend contract tests first and run them to see database routing assertions fail.
- [ ] Route login and role confirmation according to `getDataSource()`.
- [ ] Replace the pending token before confirming the local role.
- [ ] Add bearer authorization and 401/403 handling to database requests.
- [ ] Set development data source to `database` and document `DB_AUTH_SECRET` / token TTL configuration.
- [ ] Re-run focused frontend tests and confirm they pass.

### Task 4: Verification and real database integration

**Files:**
- Verify: all files above

**Interfaces:**
- Consumes: existing `dnk_swp_db` schema and a user-provided existing platform account for final UI login.

- [ ] Run all core and script tests.
- [ ] Run `npm run build`.
- [ ] Start the database adapter and verify `/health` remains public.
- [ ] Verify protected routes reject missing tokens.
- [ ] Perform a read-only schema-backed service smoke test against one existing enabled user without printing credentials or password hashes.
- [ ] Start the frontend in database mode and verify the login screen loads. Full authenticated UI verification requires an existing platform account password.
