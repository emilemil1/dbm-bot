import { CommandModule, ModuleType, ReactionModule } from "discord-dbm";
import { Message, TextChannel, DMChannel, NewsChannel, MessageReaction, User } from "discord.js";

class Delete implements CommandModule, ReactionModule {
    onLoad?: (() => Promise<void>) | undefined;
    onShutdown?: (() => Promise<void>) | undefined;
    configuration = {
        name: "Delete",
        description: "",
        type: [ModuleType.command, ModuleType.reaction],
        commands: ["delete"],
        reactions: ["❌"]
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
        const myId = message.guild?.me?.id;
        if (myId === undefined) {
            return;
        }
        this.searchForMessage(message.channel, myId).then(id => {
            if (id !== undefined) {
                const channel = message.channel as TextChannel;
                channel.bulkDelete([id]);
            }
        });
    }

    
    async onReaction(reaction: MessageReaction, user: User): Promise<void> {
        if (reaction.message.author.id !== reaction.message.guild?.me?.id) return;
        if (user.id === reaction.message.guild?.me?.id) return;
        reaction.message.delete();
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