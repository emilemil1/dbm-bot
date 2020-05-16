import { PersistenceModule, ModuleType, PersistenceData, PersistenceResult } from "discord-dbm";

class Ephemeral implements PersistenceModule {
    configuration = {
        name: "Ephemeral Storage",
        description: "",
        type: [ModuleType.persistence]
    }
    persistence = new Map<string, PersistenceData>();

    get(id: string): Promise<PersistenceData> {
        return Promise.resolve(this.persistence.get(id));
    }

    set(id: string, data: PersistenceData): Promise<PersistenceResult> {
        this.persistence.set(id, data);
        return Promise.resolve({
            result: true,
            message: id
        });
    }
}

export default new Ephemeral();