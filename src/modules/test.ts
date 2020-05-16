import { CommandModule, ModuleType } from "discord-dbm";
import { Message } from "discord.js";

class Test implements CommandModule {
    configuration = {
        name: "Test Module",
        description: "",
        type: [ModuleType.command],
        commands: ["test"]
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
        message.reply("Test!");
    }
}

export default new Test();