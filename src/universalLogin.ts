import axios from "axios";

interface UniversalLoginResponse {
    identity: Identity;
    sessions: Session[];
    apps: App[];
    requestUrl: string;
    redirectUrl: string;
}

interface App {
    enabled: boolean;
}

interface Session {
    name: string;
    value: Value;
}

interface Value {
    token?: string;
    endpoint: string;
}

interface Identity {
    username: string;
    masterUserId: number;
    userId: number;
    corporationId: number;
    privateLabelId: number;
    userTypeId: number;
    userPrimaryDepartmentId: number;
    swimLaneId: number;
    dataCenterId: number;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    locale: string;
    corporationName: string;
    allPrivateLabelIds: number[];
    isPasswordCaseSensitive: boolean;
    eStaffAgencyId: string;
    userTypeName: string;
    departmentName: string;
}

export const universalLogin = async (username: string, password: string) => {
    let form = new FormData();
    form.append('username', username);
    form.append('password', password);
    const { data } = await axios.post<UniversalLoginResponse>(`
https://universal.bullhornstaffing.com/universal-login/session/login`, form);
    const session = data.sessions.find(session => session.name === 'rest')?.value as Value;
    return { BhRestToken: session.token, restUrl: session.endpoint };
    // return cluster;
}