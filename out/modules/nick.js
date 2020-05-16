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
        if (command.length === 1) {
            return;
        }
        message.guild.me.setNickname(command.slice(1).join(" "))
            .then(() => message.channel.send("My nickname has been changed!"));
    }
}
export default new Nick();
//# sourceMappingURL=nick.js.map