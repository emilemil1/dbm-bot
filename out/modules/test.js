import { ModuleType } from "discord-dbm";
class Test {
    constructor() {
        this.configuration = {
            name: "Test Module",
            description: "",
            type: [ModuleType.command],
            commands: ["test"]
        };
    }
    async onCommand(command, message) {
        message.reply("Test!");
    }
}
export default new Test();
//# sourceMappingURL=test.js.map