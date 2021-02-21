import { ModuleType } from "discord-dbm";
class Delete {
    constructor() {
        this.configuration = {
            name: "Delete",
            description: "",
            type: [ModuleType.command, ModuleType.reaction],
            commands: ["delete"],
            reactions: ["❌"]
        };
    }
    async onCommand(command, message) {
        var _a, _b;
        const myId = (_b = (_a = message.guild) === null || _a === void 0 ? void 0 : _a.me) === null || _b === void 0 ? void 0 : _b.id;
        if (myId === undefined) {
            return;
        }
        this.searchForMessage(message.channel, myId).then(id => {
            if (id !== undefined) {
                message.channel.bulkDelete([id]);
            }
        });
    }
    async onReaction(reaction, user) {
        var _a, _b, _c, _d;
        if (reaction.message.author.id !== ((_b = (_a = reaction.message.guild) === null || _a === void 0 ? void 0 : _a.me) === null || _b === void 0 ? void 0 : _b.id))
            return;
        if (user.id === ((_d = (_c = reaction.message.guild) === null || _c === void 0 ? void 0 : _c.me) === null || _d === void 0 ? void 0 : _d.id))
            return;
        reaction.message.delete();
    }
    async searchForMessage(channel, clientUserId) {
        var _a;
        const messages = await channel.messages.fetch({
            limit: 15
        });
        return (_a = messages
            .filter(value => value.author.id === clientUserId)
            .sort((v1, v2) => v1.createdTimestamp - v2.createdTimestamp)
            .last()) === null || _a === void 0 ? void 0 : _a.id;
    }
}
export default new Delete();
//# sourceMappingURL=delete.js.map