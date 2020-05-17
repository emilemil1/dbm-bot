import { PersistenceModule, ModuleType, PersistenceData, PersistenceResult } from "discord-dbm";
import admin from "firebase-admin";
import fs from "fs";

interface Persistence {
    [key: string]: PersistenceData;
}

class Firebase implements PersistenceModule {
    configuration = {
        name: "Firebase Storage",
        description: "",
        type: [ModuleType.persistence]
    }
    persistence: Persistence = {}
    firebase: admin.app.App;

    constructor() {
        if (fs.existsSync("GOOGLE_APPLICATION_CREDENTIALS.json")) {
            process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "GOOGLE_APPLICATION_CREDENTIALS.json";
        } else if (process.env["GOOGLE_APPLICATION_CREDENTIALS"] !== undefined) {
            const content = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
            process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "GOOGLE_APPLICATION_CREDENTIALS.json";
            fs.writeFileSync("GOOGLE_APPLICATION_CREDENTIALS.json", content);
        }

        this.firebase = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: "https://hug-bot.firebaseio.com"
        });
    }

    get(id: string): Promise<PersistenceData> {
        return Promise.resolve(this.persistence[id]);
    }

    set(id: string, data: PersistenceData): Promise<PersistenceResult> {
        this.persistence[id] = data;
        return Promise.resolve({
            result: true,
            message: id
        });
    }

    async onLoad(): Promise<void> {
        this.persistence = (await this.firebase.firestore().collection("persist").doc("persist").get()).data() as unknown as Persistence;
    }

    async onShutdown(): Promise<void> {
        const result = await this.firebase.firestore().collection("persist").doc("persist").set(this.persistence, {});
    }
}

export default new Firebase();