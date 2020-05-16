import { CommandModule, ModuleType } from "discord-dbm";
import { Message, TextChannel, DMChannel, GroupDMChannel } from "discord.js";

class Delete implements CommandModule {
    configuration = {
        name: "Delete",
        description: "",
        type: [ModuleType.command],
        commands: ["delete"]
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
        this.searchForMessage(message.channel, message.client.user.id).then(id => {
            if (id !== undefined) {
                message.channel.bulkDelete([id]);
            }
        });
    }

    async searchForMessage(channel: TextChannel | DMChannel | GroupDMChannel, clientUserId: string): Promise<string | undefined> {
        const messages = await channel.fetchMessages({
            limit: 15
        });
        
        return messages
            .filter(value => value.author.id === clientUserId)
            .sort((v1, v2) => v1.createdTimestamp - v2.createdTimestamp)
            .last()
            .id;
    }
}

export default new Delete();