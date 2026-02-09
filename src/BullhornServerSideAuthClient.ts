import axios, { AxiosRequestConfig } from "axios";
import { getBHToken } from "./auth_functions";
import cron from 'node-cron';
import { EventEmitter } from "events";

/**
 * Server-side Bullhorn client with long-lived session, cron-based refresh, and event notifications.
 * Use when you need a single shared axios instance and optional automatic token refresh.
 */
export class BullhornServerSideAuthClient {
    restUrl: string | undefined;
    BhRestToken: string | undefined;
    task: cron.ScheduledTask | undefined;
    sessionExpires: Date | undefined;
    api = axios.create();
    loggedIn = false;
    eventEmitter = new EventEmitter();

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

    ) {
    }

    /**
     * Pings the Bullhorn REST API and returns the session expiry timestamp.
     *
     * @returns The session expiry value from the server
     */
    async ping() {
        const { data } = await this.api.get("/ping", { params: { BhRestToken: this.BhRestToken } });
        return data.sessionExpires;
    }

    /**
     * Authenticates with Bullhorn and configures the shared axios instance.
     * Skips if session is still valid and not expiring within 6 hours.
     * Emits "login" on success or "loginFailed" on error via eventEmitter.
     */
    async login() {
        // Check if there's an existing session that's about to expire
        if (this.sessionExpires) {
            const now = new Date();
            const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

            // If session is still valid and not expiring soon, return early
            if (this.sessionExpires > sixHoursFromNow) {
                console.log('Current session is still valid until:', this.sessionExpires);
                return;
            }
            console.log('Session expiring soon, refreshing login');
        }
        try {

            const token = await getBHToken(this.username, this.password, this.clientId, this.clientSecret, this.cluster);
            this.BhRestToken = token.BhRestToken;
            this.restUrl = token.restUrl;
            this.sessionExpires = new Date(token.sessionExpires);
            this.api.defaults.params = {
                BhRestToken: this.BhRestToken
            }
            this.api.defaults.baseURL = this.restUrl;
            this.loggedIn = true;
            this.eventEmitter.emit("login", token);
        } catch (error) {
            this.eventEmitter.emit("loginFailed", error);
        }
    }

    /**
     * Starts a cron job that refreshes the token every 30 minutes.
     * Calls login() immediately, then on the schedule.
     *
     * @throws Error if the cron is already started
     * @returns The scheduled task (for advanced use)
     */
    async startLoginCron() {
        // Schedule task to run every 30 minutes
        if (this.task) {
            throw new Error("Login cron already started");
        }
        await this.login();
        this.task = cron.schedule('*/30 * * * *', async () => {
            try {
                console.log('Running scheduled login refresh');
                await this.login();
                console.log('Login refreshed successfully, session expires:', this.sessionExpires);
            } catch (error) {
                console.error('Failed to refresh login:', error);
            }
        });

        return this.task;
    }

    /**
     * Stops the automatic login refresh cron job.
     */
    stopLoginCron() {
        if (this.task) {
            this.task.stop();
            this.task = undefined;
        }
    }

    /**
     * Sends an HTTP request using the authenticated axios instance.
     *
     * @param config - Axios request config (url, method, data, etc.)
     * @returns Axios response promise
     * @throws Error if not logged in (BhRestToken missing)
     */
    makeRequest(config: AxiosRequestConfig) {
        if (!this.BhRestToken) {
            throw new Error("Not logged in, try again in a few seconds");
        }
        return this.api.request(config);
    }


}

