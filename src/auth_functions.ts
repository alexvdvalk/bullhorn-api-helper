import axios from "axios";
import { LoginInfo } from "./interfaces";

/**
 * Exchanges Bullhorn username and password for an OAuth authorization code.
 *
 * @param username - Bullhorn username
 * @param password - Bullhorn password
 * @param clientId - OAuth client ID
 * @param cluster - Bullhorn cluster (e.g. "emea", "us", "apac")
 * @returns The authorization code to exchange for an access token
 */
export async function getAuthorizationCode(
    username: string,
    password: string,
    clientId: string,
    cluster: string
): Promise<string> {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    form.append('action', 'Login');

    const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
    });

    const authRequest = `https://auth-${cluster}.bullhornstaffing.com/oauth/authorize?${authParams}`;
    let authResponse = await axios.post(authRequest, form, {
        maxRedirects: 0,
        validateStatus: (status) => status === 302 || status === 307
    });

    // If status code is 200, send the "ACCEPT" response

    if (authResponse.status === 307) {
        console.log("Using invalid cluster, following redirect");
        const correct_url = authResponse.headers['location'];
        authResponse = await axios.post(correct_url, form, {
            maxRedirects: 0,
            validateStatus: (status) => status === 302
        });
    }

    const location = authResponse.headers['location'];
    const locationUrl = new URL(location);
    const authCode = locationUrl.searchParams.get('code');

    if (!authCode) {
        throw new Error('No authorization code received');
    }

    return authCode;
}

/**
 * Exchanges an OAuth authorization code for an access token.
 *
 * @param authCode - Authorization code from getAuthorizationCode
 * @param clientId - OAuth client ID
 * @param clientSecret - OAuth client secret
 * @param cluster - Bullhorn cluster (e.g. "emea", "us", "apac")
 * @returns The OAuth access token
 */
export async function getAccessToken(
    authCode: string,
    clientId: string,
    clientSecret: string,
    cluster: string
): Promise<string> {
    const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret
    });

    const { data } = await axios.post<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
    }>(`https://auth-${cluster}.bullhornstaffing.com/oauth/token`, tokenParams);

    return data.access_token;
}

/**
 * Uses an OAuth access token to obtain the REST API base URL and BhRestToken.
 *
 * @param accessToken - OAuth access token from getAccessToken
 * @param cluster - Bullhorn cluster (e.g. "emea", "us", "apac")
 * @param ttl - Session time-to-live in minutes (default 2880 = 2 days)
 * @returns Object with restUrl and BhRestToken for REST API calls
 */
export async function getRestTokenAndUrl(
    accessToken: string,
    cluster: string,
    ttl: number
): Promise<{ restUrl: string; BhRestToken: string }> {
    const { data } = await axios.get<{ restUrl: string; BhRestToken: string }>(
        `https://rest-${cluster}.bullhornstaffing.com/rest-services/login`,
        {
            params: {
                access_token: accessToken,
                ttl,
                version: "*"
            }
        }
    );
    return data;
}

async function getSessionExpiry(
    restUrl: string,
    bhRestToken: string
): Promise<string> {
    const { data } = await axios.get<{ sessionExpires: number }>(
        `${restUrl}/ping`,
        {
            params: {
                BhRestToken: bhRestToken,
            }
        }
    );
    return new Date(data.sessionExpires).toISOString();
}


/**
 * Retrieves a basic Bullhorn REST API token and REST URL without performing a session expiry check.
 *
 * This function executes the minimal Bullhorn OAuth flow: it exchanges the user credentials for an authorization code,
 * swaps the code for an access token, and then uses the access token to obtain the BhRestToken and API base URL.
 * 
 * @param username - The Bullhorn username.
 * @param password - The Bullhorn password.
 * @param clientId - The Bullhorn OAuth client ID.
 * @param clientSecret - The Bullhorn OAuth client secret.
 * @param cluster - The Bullhorn cluster to target (e.g., "emea", "us", "apac"). Default is "emea".
 * @param ttl - The session time-to-live in minutes. Default is 2880 (2 days).
 * @returns An object containing the REST API URL and BhRestToken.
 *
 * @example
 * const tokenData = await getSimpleBHToken("user", "pass", "clientId", "clientSecret");
 * console.log(tokenData.restUrl, tokenData.BhRestToken);
 */
export const getSimpleBHToken = async (
    username: string,
    password: string,
    clientId: string,
    clientSecret: string,
    cluster: string = "emea",
    ttl = 2880
) => {
    const authCode = await getAuthorizationCode(username, password, clientId, cluster);
    const accessToken = await getAccessToken(authCode, clientId, clientSecret, cluster);
    const restData = await getRestTokenAndUrl(accessToken, cluster, ttl);
    return restData;
}

/**
 * Full Bullhorn OAuth flow: returns REST URL, BhRestToken, and session expiry.
 * Performs a ping to determine when the session expires.
 *
 * @param username - Bullhorn username
 * @param password - Bullhorn password
 * @param clientId - OAuth client ID
 * @param clientSecret - OAuth client secret
 * @param cluster - Bullhorn cluster (default "emea")
 * @param ttl - Session time-to-live in minutes (default 2880)
 * @returns Object with restUrl, BhRestToken, and sessionExpires (ISO string)
 */
export const getBHToken = async (
    username: string,
    password: string,
    clientId: string,
    clientSecret: string,
    cluster: string = "emea",
    ttl = 2880
) => {
    try {
        const authCode = await getAuthorizationCode(username, password, clientId, cluster);
        const accessToken = await getAccessToken(authCode, clientId, clientSecret, cluster);
        const restData = await getRestTokenAndUrl(accessToken, cluster, ttl);
        const sessionExpires = await getSessionExpiry(restData.restUrl, restData.BhRestToken);

        return {
            ...restData,
            sessionExpires
        };
    } catch (error) {
        console.error(error);
        throw new Error(
            "Failed to get BH Token, check credentials and try browsing to: " +
            `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${clientId}&response_type=code&username=[username]&password=[password]&action=Login ` +
            "and accept the terms and condition"
        );
    }
}

/**
 * Resolves the Bullhorn cluster (e.g. "emea", "us") for a given username.
 *
 * @param username - Bullhorn username
 * @returns The cluster identifier string
 */
export const getCluster = async (username: string) => {
    const { data } = await axios.get<LoginInfo>(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${username}`);
    const cluster = data.oauthUrl.split('-')[1].split('.')[0];
    return cluster;
}