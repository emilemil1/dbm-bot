import { ModuleType } from "discord-dbm";
class Delete {
    constructor() {
        this.configuration = {
            name: "Delete",
            description: "",
            type: [ModuleType.command],
            commands: ["delete"]
        };
    }
    async onCommand(command, message) {
        this.searchForMessage(message.channel, message.client.user.id).then(id => {
            if (id !== undefined) {
                message.channel.bulkDelete([id]);
            }
        });
    }
    async searchForMessage(channel, clientUserId) {
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
//# sourceMappingURL=delete.js.map