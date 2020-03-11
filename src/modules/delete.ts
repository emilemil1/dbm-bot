import { Module } from "discord-dbm";
import { Message, TextChannel, DMChannel, GroupDMChannel } from "discord.js";

class Delete implements Module {
    configuration = {
        name: "Delete",
        description: "",
        commands: ["delete"]
    }
    
    onCommand(command: string[], message: Message): void {
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