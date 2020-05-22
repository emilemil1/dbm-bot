import { ModuleType } from "discord-dbm";
class Nick {
    constructor() {
        this.configuration = {
            name: "Nickname Change",
            description: "",
            type: [ModuleType.command],
            commands: ["nick"]
        };
    }
    async onCommand(command, message) {
        var _a, _b;
        if (command.length === 1) {
            return;
        }
        (_b = (_a = message.guild) === null || _a === void 0 ? void 0 : _a.me) === null || _b === void 0 ? void 0 : _b.setNickname(command.slice(1).join(" ")).then(() => message.channel.send("My nickname has been changed!"));
    }
}
export default new Nick();
//# sourceMappingURL=nick.js.map