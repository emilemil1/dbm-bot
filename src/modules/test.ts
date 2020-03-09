import { Module } from "discord-dbm";
import { Message } from "discord.js";

class Test implements Module {
    configuration = {
        name: "Test Module",
        description: "",
        commands: ["test"]
    }
    
    onCommand(command: string[], message: Message): void {
        message.reply("Test!");
    }
}

export default new Test();