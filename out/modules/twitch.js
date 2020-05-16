import { ModuleType, BotUtils } from "discord-dbm";
import dedent from "dedent";
import fetch from "node-fetch";
class Twitch {
    constructor() {
        this.configuration = {
            name: "Twitch Notifier",
            description: "",
            type: [ModuleType.command],
            commands: ["twitch"]
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
        if (command.length === 3 && command[1] === "notify") {
            this.toggleNotify(command[2], message);
            return;
        }
    }
    help(message) {
        message.channel.send(dedent `
            \`\`\`Commands:
                ${BotUtils.getPrefix()}twitch [channel]
                    - display channel info
                ${BotUtils.getPrefix()}twitch notify [channel]
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
    async toggleNotify(channel, message) {
        const guild = this.data.guilds[message.guild.id];
        if (guild === undefined || guild.chat === undefined) {
            message.channel.send(`Please first assign a chat to notify in. The command is '${BotUtils.getPrefix()}twitch here'.`);
            return;
        }
        const channelInfo = await this.getChannelInfo(channel);
        if ((channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.error) !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }
        if (guild.channels[channel] === undefined) {
            guild.channels[channel] = null;
            if (this.data.channels[channel] === undefined) {
                this.data.channels[channel] = {
                    guildIds: {},
                    count: 0
                };
                this.subscribe(channelInfo.id, true);
            }
            this.data.channels[channel].guildIds[message.guild.id] = null;
            this.data.channels[channel].count++;
            message.channel.send("Notifications enabled for Twitch channel: " + channelInfo.displayName);
            return;
        }
        delete guild.channels[channel];
        delete this.data.channels[channel].guildIds[message.guild.id];
        this.data.channels[channel].count--;
        if (this.data.channels[channel].count === 0) {
            delete this.data.channels[channel];
            this.subscribe(channelInfo.id, false);
        }
        message.channel.send("Notifications disabled for Twitch channel: " + channelInfo.displayName);
        return;
    }
    async searchChannel(channel, retry = false) {
        const options = {
            headers: {
                "Accept": "application/vnd.twitchtv.v5+json",
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            }
        };
        const result = await (await fetch(`https://api.twitch.tv/kraken/search/channels?query=${channel}&limit=1`, options)).json();
        if (result.error !== undefined) {
            if (result.status === 401 || result.status === 402 || result.status === 403) {
                return this.authorize().then(() => this.searchChannel(channel));
            }
            if (retry === false) {
                this.searchChannel(channel, true);
            }
            else {
                return {
                    id: "",
                    name: channel,
                    displayName: "",
                    error: "Could not retrieve data from Twitch, try again later."
                };
            }
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
    async getChannelInfo(channel, retry = false) {
        const options = {
            headers: {
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            }
        };
        const result = await (await fetch(`https://api.twitch.tv/helix/users?login=${channel.toLowerCase()}`, options)).json();
        if (result.error !== undefined) {
            if (result.status === 401 || result.status === 402 || result.status === 403) {
                return this.authorize().then(() => this.getChannelInfo(channel));
            }
            if (retry === false) {
                this.getChannelInfo(channel, true);
            }
            else {
                return {
                    id: "",
                    name: channel,
                    displayName: "",
                    error: "Could not retrieve data from Twitch, try again later."
                };
            }
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
    async authorize(scopes = []) {
        const options = {
            method: "POST"
        };
        const url = new URL("https://id.twitch.tv/oauth2/token");
        const params = {
            "client_id": BotUtils.getValue("twitchId"),
            "client_secret": BotUtils.getSecret("twitchSecret"),
            "grant_type": "client_credentials",
        };
        if (scopes.length !== 0)
            params["scope"] = scopes.join(" ");
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const result = await (await fetch(url, options)).json();
        this.token = result.access_token;
        return result.access_token;
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
    async subscribe(channelId, subscribe, retry = false) {
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            },
            body: JSON.stringify({
                "hub.callback": "http://localhost",
                "hub.mode": subscribe ? "subscribe" : "unsubscribe",
                "hub.topic": "https://api.twitch.tv/helix/streams?user_id=" + channelId,
                "hub.lease_seconds": "864000"
            })
        };
        const result = await fetch("https://api.twitch.tv/helix/webhooks/hub", options);
        if (result.status === 401 || result.status === 402 || result.status === 403) {
            return this.authorize().then(() => this.subscribe(channelId, subscribe));
        }
        if (retry === false) {
            this.subscribe(channelId, true);
        }
        else {
            return "Could not send data to Twitch, try again later.";
        }
    }
    async receiveWebhook(message) {
        return;
    }
}
export default new Twitch();
//# sourceMappingURL=twitch.js.map