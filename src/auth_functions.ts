import axios from "axios";
import { LoginInfo } from "./interfaces";

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

export const getCluster = async (username: string) => {
    const { data } = await axios.get<LoginInfo>(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${username}`);
    const cluster = data.oauthUrl.split('-')[1].split('.')[0];
    return cluster;
}