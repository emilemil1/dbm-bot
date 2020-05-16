import { ModuleType, BotUtils } from "discord-dbm";
import dedent from "dedent";
import fetch from "node-fetch";
class Twitch {
    constructor() {
        this.configuration = {
            name: "Twitch Notifier",
            description: "",
            type: [ModuleType.command, ModuleType.webhook],
            commands: ["twitch"],
            webhook: ["/twitch"]
        };
        this.data = {
            guilds: {},
            channels: {}
        };
        this.token = "";
        this.clientId = BotUtils.getValue("twitchId");
        this.clientSecret = BotUtils.getValue("twitchSecret");
        this.authorize();
    }
    async onLoad() {
        var _a;
        const data = await ((_a = BotUtils.storage) === null || _a === void 0 ? void 0 : _a.get("twitch"));
        if (data !== undefined)
            this.data = data;
    }
    async onShutdown() {
        var _a;
        await ((_a = BotUtils.storage) === null || _a === void 0 ? void 0 : _a.set("twitch", this.data));
    }
    async onCommand(command, message) {
        if (command.length === 1) {
            this.help(message);
            return;
        }
        if (command.length === 2 && command[1] === "here") {
            this.here(message);
            return;
        }
        if (command.length === 2) {
            this.info(command[1], message);
            return;
        }
        if (command.length === 3 && command[1] === "follow") {
            this.follow(command[2], message);
            return;
        }
        if (command.length === 3 && command[1] === "unfollow") {
            this.unfollow(command[2], message);
            return;
        }
    }
    async hook(message) {
        var _a;
        console.log("hook");
        console.log(message);
        if (message.body === "") {
            const index = message.webhook.indexOf("hub.challenge=");
            return {
                code: 200,
                body: message.webhook.substring(index + 14, message.webhook.indexOf("&", index))
            };
        }
        const json = JSON.parse(message.body);
        if (json.data.length === 0 || this.data.channels[json.data[0].user_name] === undefined) {
            return {
                code: 200
            };
        }
        for (const guildId in this.data.channels[json.data[0].user_name].guildIds) {
            const guild = this.data.guilds[guildId];
            if (guild.chat === undefined)
                continue;
            const chat = (_a = BotUtils.getDiscordClient().guilds.get(guildId)) === null || _a === void 0 ? void 0 : _a.channels.get(guild.chat);
            chat.send(dedent `
                https://twitch.tv/${json.data[0].user_name} is now live!
                Streaming: ${json.data[0].title}
                `);
        }
        return {
            code: 200
        };
    }
    help(message) {
        message.channel.send(dedent `
            \`\`\`Commands:
                ${BotUtils.getPrefix()}twitch [channel]
                    - display channel info
                ${BotUtils.getPrefix()}twitch follow/unfollow [channel]
                    - toggle channel notifications
                ${BotUtils.getPrefix()}twitch here
                    - toggle notification chatroom\`\`\`
            `.trim());
    }
    async info(channel, message) {
        var _a;
        const channelInfo = await this.searchChannel(channel);
        if ((channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.error) !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }
        if (channel !== channelInfo.name) {
            message.channel.send("The channel could not be found. Did you mean this one?");
        }
        const notificationsEnabled = ((_a = this.data.guilds[message.guild.id]) === null || _a === void 0 ? void 0 : _a.channels[channel]) !== undefined;
        message.channel.send(`https://twitch.tv/${channelInfo.name}${notificationsEnabled ? " (notifications enabled)" : ""}`);
    }
    async follow(channel, message) {
        const guild = this.data.guilds[message.guild.id];
        if (guild === undefined || guild.chat === undefined) {
            message.channel.send(`Please first assign a chat to notify in. The command is '${BotUtils.getPrefix()}twitch here'.`);
            return;
        }
        if (guild.channels[channel] !== undefined) {
            message.channel.send("Notifications are already active for this channel.");
            return;
        }
        const channelInfo = await this.getChannelInfo(channel);
        if ((channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.error) !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }
        console.log("1");
        guild.channels[channel] = null;
        if (this.data.channels[channel] === undefined) {
            console.log("2");
            this.data.channels[channel] = {
                guildIds: {},
                count: 0
            };
            console.log("3");
            await this.subscribe(channelInfo, true);
        }
        console.log("4");
        this.data.channels[channel].guildIds[message.guild.id] = null;
        this.data.channels[channel].count++;
        message.channel.send("Notifications enabled for Twitch channel: " + channelInfo.displayName);
        return;
    }
    async unfollow(channel, message) {
        const guild = this.data.guilds[message.guild.id];
        if (guild.channels[channel] === undefined) {
            message.channel.send("Notifications are not active for this channel.");
            return;
        }
        const channelInfo = await this.getChannelInfo(channel);
        if ((channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.error) !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }
        delete guild.channels[channel];
        delete this.data.channels[channel].guildIds[message.guild.id];
        this.data.channels[channel].count--;
        if (this.data.channels[channel].count === 0) {
            delete this.data.channels[channel];
            await this.subscribe(channelInfo, false);
        }
        message.channel.send("Notifications disabled for Twitch channel: " + channelInfo.displayName);
    }
    async searchChannel(channel) {
        const options = {
            headers: {
                "Accept": "application/vnd.twitchtv.v5+json",
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            }
        };
        const result = await (await this.call(`https://api.twitch.tv/kraken/search/channels?query=${channel}&limit=1`, options)).json();
        if (result.error !== undefined) {
            return {
                id: "",
                name: channel,
                displayName: "",
                error: "Could not retrieve data from Twitch, try again later."
            };
        }
        if (result.channels.length === 0) {
            return {
                id: "",
                name: channel,
                displayName: "",
                error: "Could not find a matching channel."
            };
        }
        return {
            id: result.channels[0].id,
            name: result.channels[0].name,
            displayName: result.channels[0].display_name,
        };
    }
    async getChannelInfo(channel) {
        const options = {
            headers: {
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            }
        };
        const result = await (await this.call(`https://api.twitch.tv/helix/users?login=${channel.toLowerCase()}`, options)).json();
        if (result.error !== undefined) {
            return {
                id: "",
                name: channel,
                displayName: "",
                error: "Could not retrieve data from Twitch, try again later."
            };
        }
        if (result.data.length === 0) {
            return {
                id: "",
                name: channel,
                displayName: "",
                error: "This channel does not exist."
            };
        }
        return {
            id: result.data[0].id,
            name: channel,
            displayName: result.data[0].display_name
        };
    }
    here(message) {
        let guild = this.data.guilds[message.guild.id];
        if (guild === undefined) {
            guild = {
                channels: {}
            };
            this.data.guilds[message.guild.id] = guild;
        }
        if (guild.chat !== message.channel.id) {
            guild.chat = message.channel.id;
            message.channel.send("Twitch notifications will now appear in this chat!");
        }
        else {
            guild.chat = undefined;
            message.channel.send("Twitch notifications will no longer appear.");
        }
        return;
    }
    async subscribe(channelInfo, subscribe) {
        console.log("here");
        console.error("here");
        const url = BotUtils.getValue("url");
        const port = BotUtils.getValue("webhookPort");
        console.log(`https://${url}":"${port}"/webhook/twitch`);
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            },
            body: JSON.stringify({
                "hub.callback": `https://${url}":"${port}"/webhook/twitch`,
                "hub.mode": subscribe ? "subscribe" : "unsubscribe",
                "hub.topic": "https://api.twitch.tv/helix/streams?user_id=" + channelInfo.id,
                "hub.lease_seconds": "864000"
            })
        };
        const result = await this.call("https://api.twitch.tv/helix/webhooks/hub", options);
        if (!result.ok) {
            return "Could not send data to Twitch, try again later.";
        }
    }
    async call(url, options, scopes, retry = true) {
        const result = await fetch(url, options);
        if (result.ok || retry === false) {
            return result;
        }
        if (result.status === 401 || result.status === 402 || result.status === 403) {
            return this.authorize().then(() => this.call(url, options, scopes, retry = false));
        }
        return result;
    }
    async authorize(scopes = []) {
        const options = {
            method: "POST"
        };
        const url = new URL("https://id.twitch.tv/oauth2/token");
        const params = {
            "client_id": BotUtils.getValue("twitchId"),
            "client_secret": BotUtils.getValue("twitchSecret"),
            "grant_type": "client_credentials",
        };
        if (scopes.length !== 0)
            params["scope"] = scopes.join(" ");
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const result = await (await fetch(url, options)).json();
        this.token = result.access_token;
        return result.access_token;
    }
}
export default new Twitch();
//# sourceMappingURL=twitch.js.map