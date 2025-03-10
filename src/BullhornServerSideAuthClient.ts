import axios, { AxiosRequestConfig } from "axios";
import { getBHToken } from "./auth_functions";
import cron from 'node-cron';
import { EventEmitter } from "events";
export class BullhornServerSideAuthClient {
    restUrl: string | undefined;
    BhRestToken: string | undefined;
    task: cron.ScheduledTask | undefined;
    sessionExpires: Date | undefined;
    api = axios.create();
    loggedIn = false;
    eventEmitter = new EventEmitter();

    constructor(
        private username: string,
        private password: string,
        private clientId: string,
        private clientSecret: string,
        private cluster: string = "emea"

    ) {
    }

    async ping() {
        const { data } = await this.api.get("/ping", { params: { BhRestToken: this.BhRestToken } });
        return data.sessionExpires;
    }

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

    stopLoginCron() {
        if (this.task) {
            this.task.stop();
            this.task = undefined;
        }
    }

    makeRequest(config: AxiosRequestConfig) {
        if (!this.BhRestToken) {
            throw new Error("Not logged in, try again in a few seconds");
        }
        return this.api.request(config);
    }


}

