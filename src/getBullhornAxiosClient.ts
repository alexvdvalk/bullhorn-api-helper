import axios from "axios";
import { getSimpleBHToken } from "./auth_functions";

export async function getBullhornAxiosClient(username: string, password: string, clientId: string, clientSecret: string, cluster: string = "emea") {
    const token = await getSimpleBHToken(username, password, clientId, clientSecret, cluster);
    return axios.create({
        baseURL: token.restUrl,
        params: {
            BhRestToken: token.BhRestToken
        }
    });
}