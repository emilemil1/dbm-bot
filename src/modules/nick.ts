import { CommandModule, ModuleType } from "discord-dbm";
import { Message } from "discord.js";

class Nick implements CommandModule {
    configuration = {
        name: "Nickname Change",
        description: "",
        type: [ModuleType.command],
        commands: ["nick"]
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
        if (command.length === 1) {
            return;
        }

        message.guild.me.setNickname(command.slice(1).join(" "))
            .then(() => message.channel.send("My nickname has been changed!"));
    }
}

export default new Nick();