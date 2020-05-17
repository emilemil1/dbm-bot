import { ModuleType } from "discord-dbm";
import admin from "firebase-admin";
import fs from "fs";
class Firebase {
    constructor() {
        this.configuration = {
            name: "Firebase Storage",
            description: "",
            type: [ModuleType.persistence]
        };
        this.persistence = {};
        if (fs.existsSync("GOOGLE_APPLICATION_CREDENTIALS.json")) {
            process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "GOOGLE_APPLICATION_CREDENTIALS.json";
        }
        else if (process.env["GOOGLE_APPLICATION_CREDENTIALS"] !== undefined) {
            const content = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
            process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "GOOGLE_APPLICATION_CREDENTIALS.json";
            fs.writeFileSync("GOOGLE_APPLICATION_CREDENTIALS.json", content);
        }
        this.firebase = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: "https://hug-bot.firebaseio.com"
        });
    }
    get(id) {
        return Promise.resolve(this.persistence[id]);
    }
    set(id, data) {
        this.persistence[id] = data;
        return Promise.resolve({
            result: true,
            message: id
        });
    }
    async onLoad() {
        this.persistence = (await this.firebase.firestore().collection("persist").doc("persist").get()).data();
        console.log(this.persistence);
    }
    async onShutdown() {
        await this.firebase.firestore().collection("persist").doc("persist").set(this.persistence);
        console.log(this.persistence);
    }
}
export default new Firebase();
//# sourceMappingURL=firebase.js.map