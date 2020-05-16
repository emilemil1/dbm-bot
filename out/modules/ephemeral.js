import { ModuleType } from "discord-dbm";
class Ephemeral {
    constructor() {
        this.configuration = {
            name: "Ephemeral Storage",
            description: "",
            type: [ModuleType.persistence]
        };
        this.persistence = new Map();
    }
    get(id) {
        return Promise.resolve(this.persistence.get(id));
    }
    set(id, data) {
        this.persistence.set(id, data);
        return Promise.resolve({
            result: true,
            message: id
        });
    }
}
export default new Ephemeral();
//# sourceMappingURL=ephemeral.js.map