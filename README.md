# Bullhorn Server-Side Authentication Helper

A Node.js module for server-side authentication with the Bullhorn REST API. This package simplifies the process of obtaining and managing Bullhorn authentication tokens for server-side applications.

## Installation

```bash
npm install bullhorn-api-helper
```

## Features

- Server-side authentication with Bullhorn REST API
- Token management and automatic refresh
- Event-based notifications for authentication state changes
- Support for different Bullhorn clusters (US, EMEA, etc.)
- TypeScript support with full type definitions

## Usage

### Basic Authentication

```typescript
import { getBHToken } from "bullhorn-api-helper";

async function authenticate() {
  try {
    const token = await getBHToken(
      "username",
      "password",
      "clientId",
      "clientSecret",
      "emea" // or other cluster
    );

    console.log("Authentication successful!");
    console.log("BhRestToken:", token.BhRestToken);
    console.log("REST URL:", token.restUrl);
    console.log("Session expires:", token.sessionExpires);

    return token;
  } catch (error) {
    console.error("Authentication failed:", error);
  }
}
```

### Using the BullhornServerSideAuthClient Class

```typescript
import { BullhornServerSideAuthClient } from "bullhorn-api-helper";

// Create a client instance
const client = new BullhornServerSideAuthClient(
  "username",
  "password",
  "clientId",
  "clientSecret",
  "emea" // or other cluster
);

// Listen for authentication events
client.on("login", (data) => {
  console.log("Logged in successfully!", data);
});

client.on("loginFailed", (error) => {
  console.error("Login failed:", error);
});

// Login
await client.login();

// Make API requests
// The client's axios instance is pre-configured with the auth token
const response = await client.api.get("/entity/Candidate/5");

// Enable automatic token refresh (runs every 30 minutes)
client.startLoginCron();

// Later, when you're done
client.stopLoginCron();
```

## API Reference

### Functions

#### `getBHToken(username, password, clientId, clientSecret, cluster)`

Authenticates with Bullhorn and returns a token object.

- **Parameters**:
  - `username` (string): Bullhorn username
  - `password` (string): Bullhorn password
  - `clientId` (string): OAuth client ID
  - `clientSecret` (string): OAuth client secret
  - `cluster` (string, optional): Bullhorn cluster (default: 'emea')
- **Returns**: Promise resolving to a token object with:
  - `BhRestToken`: The Bullhorn REST token
  - `restUrl`: The REST API URL for this session
  - `sessionExpires`: Timestamp when the session expires

### Classes

#### `BullhornServerSideAuthClient`

A class that manages Bullhorn authentication and provides an event-based interface.

- **Constructor**: `new BullhornServerSideAuthClient(username, password, clientId, clientSecret, cluster)`

- **Properties**:

  - `api`: Axios instance pre-configured with authentication
  - `loggedIn`: Boolean indicating if the client is logged in
  - `sessionExpires`: Date object indicating when the session expires

- **Methods**:

  - `login()`: Authenticates with Bullhorn
  - `startLoginCron()`: Starts automatic token refresh (every 30 minutes)
  - `stopLoginCron()`: Stops the automatic token refresh
  - `checkSessionStatus()`: Checks if the session is about to expire
  - `makeRequest()`: Make API request once logged in.

- **Events**:
  - `login`: Emitted when login is successful
  - `loginFailed`: Emitted when login fails

## TypeScript Support

This package includes TypeScript definitions for all exported functions, classes, and interfaces.

## License

MIT
