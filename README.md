# Bullhorn API Helper

A Node.js module for server-side authentication with the Bullhorn REST API. This package simplifies obtaining and managing Bullhorn authentication tokens for server-side applications.

## Installation

```bash
npm install bullhorn-api-helper
```

## Features

- Server-side authentication with Bullhorn REST API
- Token management with optional caching and automatic refresh
- **SimpleBullhornAuthClient**: lightweight client with 30-minute credential cache and coalesced token fetches
- **BullhornServerSideAuthClient**: event-based client with shared axios instance and optional cron-based refresh
- Support for different Bullhorn clusters (US, EMEA, APAC, etc.)
- Universal Login support
- TypeScript support with full type definitions

## Usage

### Basic token functions

```typescript
import { getBHToken, getSimpleBHToken, getCluster } from "bullhorn-api-helper";

// Full token with session expiry
const token = await getBHToken(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea" // or "us", "apac", etc.
);
console.log("BhRestToken:", token.BhRestToken);
console.log("REST URL:", token.restUrl);
console.log("Session expires:", token.sessionExpires);

// Minimal token (restUrl + BhRestToken only)
const simpleToken = await getSimpleBHToken(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea"
);

// Resolve cluster for a username
const cluster = await getCluster("username");
```

### SimpleBullhornAuthClient (recommended for request-scoped usage)

Returns a fresh axios instance per call. Credentials are cached for 30 minutes; concurrent calls share a single in-flight token fetch.

```typescript
import { SimpleBullhornAuthClient } from "bullhorn-api-helper";

const client = new SimpleBullhornAuthClient(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea"
);

// Each call returns a new axios instance (cached credentials if still valid)
const api = await client.getBullhornAPIClient();
const response = await api.get("/entity/Candidate/5");
```

### BullhornServerSideAuthClient (shared axios instance + cron refresh)

Use when you want one shared axios instance and optional automatic token refresh every 30 minutes.

```typescript
import { BullhornServerSideAuthClient } from "bullhorn-api-helper";

const client = new BullhornServerSideAuthClient(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea"
);

// Listen for authentication events
client.eventEmitter.on("login", (data) => {
  console.log("Logged in successfully!", data);
});
client.eventEmitter.on("loginFailed", (error) => {
  console.error("Login failed:", error);
});

// Login (skips if session still valid and not expiring within 6 hours)
await client.login();

// Use the shared axios instance
const response = await client.api.get("/entity/Candidate/5");

// Or use makeRequest
const data = await client.makeRequest({ method: "GET", url: "/entity/Candidate/5" });

// Optional: automatic token refresh every 30 minutes (throws if already started)
await client.startLoginCron();

// Later
client.stopLoginCron();
```

### Universal Login

```typescript
import { universalLogin } from "bullhorn-api-helper";

const { BhRestToken, restUrl } = await universalLogin("username", "password");
```

## API Reference

### Functions

#### `getBHToken(username, password, clientId, clientSecret, cluster?, ttl?)`

Full Bullhorn OAuth flow. Returns REST URL, BhRestToken, and session expiry (ISO string).

- **Parameters**: `username`, `password`, `clientId`, `clientSecret`, `cluster` (default `"emea"`), `ttl` (minutes, default 2880)
- **Returns**: `Promise<{ restUrl, BhRestToken, sessionExpires }>`

#### `getSimpleBHToken(username, password, clientId, clientSecret, cluster?, ttl?)`

Minimal OAuth flow. Returns REST URL and BhRestToken only (no session expiry check).

- **Parameters**: same as `getBHToken`
- **Returns**: `Promise<{ restUrl, BhRestToken }>`

#### `getCluster(username)`

Resolves the Bullhorn cluster for a given username.

- **Parameters**: `username`
- **Returns**: `Promise<string>` (e.g. `"emea"`, `"us"`)

#### `getAuthorizationCode(username, password, clientId, cluster)`

Exchanges credentials for an OAuth authorization code. Used internally by the token functions.

#### `getAccessToken(authCode, clientId, clientSecret, cluster)`

Exchanges an authorization code for an OAuth access token.

#### `getRestTokenAndUrl(accessToken, cluster, ttl)`

Uses an access token to obtain the REST base URL and BhRestToken.

#### `universalLogin(username, password)`

Authenticates via Bullhorn Universal Login. Returns `{ BhRestToken, restUrl }`.

### Classes

#### `SimpleBullhornAuthClient`

Lightweight client that returns a fresh axios instance per call. Caches credentials for 30 minutes and coalesces concurrent token fetches.

- **Constructor**: `new SimpleBullhornAuthClient(username, password, clientId, clientSecret, cluster?)`
- **Methods**:
  - **`getBullhornAPIClient()`**: Returns a Promise of an axios instance configured with Bullhorn REST URL and BhRestToken. Uses cache if still valid; otherwise fetches a new token (single in-flight fetch for concurrent callers).

#### `BullhornServerSideAuthClient`

Manages Bullhorn authentication with a shared axios instance and optional cron-based refresh.

- **Constructor**: `new BullhornServerSideAuthClient(username, password, clientId, clientSecret, cluster?)`
- **Properties**:
  - `api`: Axios instance (configured after `login()`)
  - `loggedIn`: Boolean
  - `restUrl`, `BhRestToken`, `sessionExpires`: Set after login
  - `eventEmitter`: Node `EventEmitter` for `"login"` and `"loginFailed"` events
- **Methods**:
  - **`login()`**: Authenticates and configures `api`. Skips if session still valid and not expiring within 6 hours.
  - **`ping()`**: Pings the REST API and returns the session expiry from the server.
  - **`startLoginCron()`**: Starts a cron that refreshes the token every 30 minutes. Calls `login()` immediately. Throws if cron already started.
  - **`stopLoginCron()`**: Stops the refresh cron.
  - **`makeRequest(config)`**: Sends a request using the authenticated axios instance. Throws if not logged in.

### Interfaces

#### `LoginInfo`

Bullhorn login info from the REST loginInfo endpoint (URLs and data center identifiers). Used by `getCluster` and related flows.

## TypeScript

This package includes TypeScript definitions for all exported functions, classes, and interfaces.

## License

MIT
