import axios, { AxiosInstance } from "axios";
import { getSimpleBHToken } from "./auth_functions";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Lightweight Bullhorn client that returns a fresh axios instance per call.
 * Caches credentials for 30 minutes and coalesces concurrent token fetches.
 */
export class SimpleBullhornAuthClient {
    private cachedToken: { restUrl: string; BhRestToken: string } | null = null;
    private cacheExpiresAt: Date | null = null;
    private tokenFetchPromise: Promise<{ restUrl: string; BhRestToken: string }> | null = null;

    /**
     * @param username - Bullhorn username
     * @param password - Bullhorn password
     * @param clientId - OAuth client ID
     * @param clientSecret - OAuth client secret
     * @param cluster - Bullhorn cluster (default "emea")
     */
    constructor(
        private username: string,
        private password: string,
        private clientId: string,
        private clientSecret: string,
        private cluster: string = "emea"
    ) { }

    /**
     * Returns an axios instance configured with Bullhorn REST URL and BhRestToken.
     * Uses cached credentials if still valid (within 30 minutes); otherwise fetches a new token.
     * Concurrent calls share a single in-flight token fetch.
     *
     * @returns Axios instance with baseURL and BhRestToken params set
     */
    async getBullhornAPIClient(): Promise<AxiosInstance> {
        const now = new Date();
        if (this.cachedToken && this.cacheExpiresAt && this.cacheExpiresAt > now) {
            return axios.create({
                baseURL: this.cachedToken.restUrl,
                params: {
                    BhRestToken: this.cachedToken.BhRestToken
                }
            });
        }

        if (!this.tokenFetchPromise) {
            this.tokenFetchPromise = (async () => {
                try {
                    const token = await getSimpleBHToken(this.username, this.password, this.clientId, this.clientSecret, this.cluster);
                    this.cachedToken = { restUrl: token.restUrl, BhRestToken: token.BhRestToken };
                    this.cacheExpiresAt = new Date(Date.now() + CACHE_TTL_MS);
                    return this.cachedToken;
                } finally {
                    this.tokenFetchPromise = null;
                }
            })();
        }

        const token = await this.tokenFetchPromise;
        return axios.create({
            baseURL: token.restUrl,
            params: {
                BhRestToken: token.BhRestToken
            }
        });
    }
}