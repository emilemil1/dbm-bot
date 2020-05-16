import { PersistenceModule, ModuleType, PersistenceData, PersistenceResult, BotUtils } from "discord-dbm";
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
    firebaseConfig = {
        apiKey: "",
        authDomain: "hug-bot.firebaseapp.com",
        databaseURL: "https://hug-bot.firebaseio.com",
        projectId: "hug-bot",
        storageBucket: "hug-bot.appspot.com"
    }
    firebase: admin.app.App;

    constructor() {
        this.firebaseConfig.apiKey = BotUtils.getValue("firebaseKey");
        if (fs.existsSync("GOOGLE_APPLICATION_CREDENTIALS.json")) {
            const cred = fs.readFileSync("GOOGLE_APPLICATION_CREDENTIALS.json", {
                encoding: "utf8"
            });
            process.env["GOOGLE_APPLICATION_CREDENTIALS.json"] = cred;
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
        this.persistence = this.firebase.firestore().collection("persist").doc("persist").get() as unknown as Persistence;
        console.log(this.persistence);
    }

    async onShutdown(): Promise<void> {
        this.firebase.firestore().collection("persist").doc("persist").set(this.persistence);
        console.log(this.persistence);
    }
}

export default new Firebase();