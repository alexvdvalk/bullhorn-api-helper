# Bullhorn API Helper

A Node.js module for server-side authentication with the Bullhorn REST API. This package simplifies obtaining and managing Bullhorn authentication tokens for server-side applications.

## Installation

```bash
npm install bullhorn-api-helper
```

## Features

- Server-side authentication with Bullhorn REST API
- Token management with optional caching and automatic refresh
- **`getBullhornAxiosClient`**: one-shot helper that returns a configured axios instance
- **SimpleBullhornAuthClient**: lightweight client with 30-minute credential cache and coalesced token fetches
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
  "emea", // or "us", "apac", etc.
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
  "emea",
);

// Resolve cluster for a username
const cluster = await getCluster("username");
```

### getBullhornAxiosClient (one-shot axios instance)

Returns a configured axios instance in a single call. Useful for scripts or one-off requests where you do not need credential caching or session refresh.

```typescript
import { getBullhornAxiosClient } from "bullhorn-api-helper";

const api = await getBullhornAxiosClient(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea",
);

const { data } = await api.get("/entity/Candidate/5");
```

For repeated requests, prefer `SimpleBullhornAuthClient` (credential cache)

### SimpleBullhornAuthClient (recommended for request-scoped usage)

Returns a fresh axios instance per call. Credentials are cached for 30 minutes; concurrent calls share a single in-flight token fetch.

```typescript
import { SimpleBullhornAuthClient } from "bullhorn-api-helper";

const client = new SimpleBullhornAuthClient(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea",
);

// Each call returns a new axios instance (cached credentials if still valid)
const api = await client.getBullhornAPIClient();
const response = await api.get("/entity/Candidate/5");
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

#### `getBullhornAxiosClient(username, password, clientId, clientSecret, cluster?)`

Authenticates via `getSimpleBHToken` and returns an axios instance with `baseURL` set to the REST URL and `BhRestToken` attached as a default query parameter.

- **Parameters**: `username`, `password`, `clientId`, `clientSecret`, `cluster` (default `"emea"`)
- **Returns**: `Promise<AxiosInstance>`
- **Note**: No credential caching or automatic refresh. Each call performs a full token exchange.

### Classes

#### `SimpleBullhornAuthClient`

Lightweight client that returns a fresh axios instance per call. Caches credentials for 30 minutes and coalesces concurrent token fetches.

- **Constructor**: `new SimpleBullhornAuthClient(username, password, clientId, clientSecret, cluster?)`
- **Methods**:
  - **`getBullhornAPIClient()`**: Returns a Promise of an axios instance configured with Bullhorn REST URL and BhRestToken. Uses cache if still valid; otherwise fetches a new token (single in-flight fetch for concurrent callers).

### Interfaces

#### `LoginInfo`

Bullhorn login info from the REST loginInfo endpoint (URLs and data center identifiers). Used by `getCluster` and related flows.

## TypeScript

This package includes TypeScript definitions for all exported functions, classes, and interfaces.

## License

MIT
