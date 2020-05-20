import { CommandModule, ModuleType } from "discord-dbm";
import { Message, TextChannel, DMChannel, NewsChannel } from "discord.js";

class Delete implements CommandModule {
    configuration = {
        name: "Delete",
        description: "",
        type: [ModuleType.command],
        commands: ["delete"]
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
        const myId = message.guild?.me?.id;
        if (myId === undefined) {
            return;
        }
        this.searchForMessage(message.channel, myId).then(id => {
            if (id !== undefined) {
                message.channel.bulkDelete([id]);
            }
        });
    }

    async searchForMessage(channel: TextChannel | DMChannel | NewsChannel, clientUserId: string): Promise<string | undefined> {
        const messages = await channel.messages.fetch({
            limit: 15
        });
        
        return messages
            .filter(value => value.author.id === clientUserId)
            .sort((v1, v2) => v1.createdTimestamp - v2.createdTimestamp)
            .last()?.id;
    }
}

export default new Delete();