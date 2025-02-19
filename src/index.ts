import axios from "axios";
import { LoginInfo } from "./interfaces";

export const getBHToken = async (username: string, password: string, clientId: string, clientSecret: string, cluster: string = "emea", ttl = 2880) => {

    console.log("Getting BH Token");

    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    form.append('action', 'Login');
    // Step 1: Get authorization code
    const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
    });
    // oauthUrl = 'https://auth-emea9.bullhornstaffing.com/oauth'
    // const authUrl = 'https://auth.bullhornstaffing.com/oauth/authorize';
    // const tokenUrl = 'https://auth.bullhornstaffing.com/oauth/token';
    // const loginUrl = 'https://login.bullhornstaffing.com/oauth/authorize';

    const authRequest = `https://auth-${cluster}.bullhornstaffing.com/oauth/authorize?${authParams}`
    let authResponse = await axios.post(authRequest, form, {
        maxRedirects: 0,
        validateStatus: (status) => {
            return status === 302 || status === 307; // Accept both temporary and permanent redirects
        }
    });
    if (authResponse.status === 307) {
        console.log("Using invalid cluster, following redirect");
        let correct_url = authResponse.headers['location'];
        authResponse = await axios.post(correct_url, form, {
            maxRedirects: 0,
            validateStatus: (status) => {
                return status === 302; // Accept both temporary and permanent redirects
            }
        });
    }
    const location = authResponse.headers['location'];
    const locationUrl = new URL(location);
    const authCode = locationUrl.searchParams.get('code');

    if (!authCode) {
        throw new Error('No authorization code received');
    }

    // Step 2: Exchange code for access token
    const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret
    });

    const { data } = await axios.post<{ access_token: string; token_type: string; expires_in: number; refresh_token: string }>(`https://auth-${cluster}.bullhornstaffing.com/oauth/token`, tokenParams);

    // restUrl
    const restResponse = await axios.get<{ restUrl: string; BhRestToken: string }>(`https://rest-${cluster}.bullhornstaffing.com/rest-services/login`, {
        params: {
            access_token: data.access_token,
            ttl,
            version: "*"
        }
    });

    const sessionExpires = await axios.get<{ sessionExpires: number }>(`${restResponse.data.restUrl}/ping`, {
        params: {
            BhRestToken: restResponse.data.BhRestToken,
        }
    });


    return {
        ...restResponse.data,
        sessionExpires: new Date(sessionExpires.data.sessionExpires).toISOString()
    }


}


export const getCluster = async (username: string) => {
    const { data } = await axios.get<LoginInfo>(`https://rest.bullhornstaffing.com/rest-services/loginInfo?username=${username}`);
    // "oauthUrl": "https://auth-emea9.bullhornstaffing.com/oauth",
    const cluster = data.oauthUrl.split('-')[1].split('.')[0];
    return cluster;
}