import { CommandModule, ModuleType, BotUtils, PersistenceData, WebhookModule, WebhookMessage, WebhookResponse } from "discord-dbm";
import { Message, TextChannel } from "discord.js";
import dedent from "dedent";
import fetch, { RequestInit, Response } from "node-fetch";

interface TwitchChannelNames {
    [key: string]: null;
}

interface Guild {
    chat?: string;
    channels: TwitchChannelNames;
}

interface Guilds {
    [key: string]: Guild;
}

interface GuildIds {
    [key: string]: null;
}

interface TwitchChannel {
    guildIds: GuildIds;
    count: number;
    id: string;
}

interface TwitchChannels {
    [key: string]: TwitchChannel;
}

interface Persistence {
    guilds: Guilds;
    channels: TwitchChannels;
}

interface TwitchChannelInfo {
    id: string;
    name: string;
    displayName: string;
    error?: string;
}

interface Params {
    [key: string]: string;
}

class Twitch implements CommandModule, WebhookModule {
    configuration = {
        name: "Twitch Notifier",
        description: "",
        type: [ModuleType.command, ModuleType.webhook],
        commands: ["twitch"],
        webhook: ["/twitch"]
    }
    data: Persistence = {
        guilds: {},
        channels: {}
    }
    clientId = "";
    clientSecret = "";
    token = "";

    async onLoad(): Promise<void> {
        this.clientId = BotUtils.getValue("twitchId");
        this.clientSecret = BotUtils.getValue("twitchSecret");
        this.authorize();
        setInterval(() => this.renewFollows(), 3600000);
        const data = await BotUtils.storage?.get("twitch");
        if (data !== undefined) this.data = data as unknown as Persistence;
    }

    async onShutdown(): Promise<void> {
        await BotUtils.storage?.set("twitch", this.data as unknown as PersistenceData);
    }
    
    async onCommand(command: string[], message: Message): Promise<void> {
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

    async hook(message: WebhookMessage): Promise<WebhookResponse> {
        if (message.body === "") {
            const index = message.webhook.indexOf("hub.challenge=");
            return {
                code: 200,
                body: message.webhook.substring(index+14, message.webhook.indexOf("&", index))
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
            if (guild.chat === undefined) continue;
            const chat = BotUtils.getDiscordClient().guilds.get(guildId)?.channels.get(guild.chat) as TextChannel;
            chat.send(
                dedent`
                https://twitch.tv/${json.data[0].user_name} is now live!
                Streaming: ${json.data[0].title}
                `
            );
        }

        return {
            code: 200
        };
    }

    help(message: Message): void {
        message.channel.send(
            dedent`
            \`\`\`Commands:
                ${BotUtils.getPrefix()}twitch [channel]
                    - display channel info
                ${BotUtils.getPrefix()}twitch follow/unfollow [channel]
                    - toggle channel notifications
                ${BotUtils.getPrefix()}twitch here
                    - toggle notification chatroom\`\`\`
            `.trim()
        );
    }

    async info(channel: string, message: Message): Promise<void> {
        const channelInfo = await this.searchChannel(channel);
        if (channelInfo?.error !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }
        if (channel !== channelInfo.name) {
            message.channel.send("The channel could not be found. Did you mean this one?");
        }
        const notificationsEnabled = this.data.guilds[message.guild.id]?.channels[channel] !== undefined;
        message.channel.send(`https://twitch.tv/${channelInfo.name}${notificationsEnabled ? " (notifications enabled)" : ""}`);
    }

    async follow(channel: string, message: Message): Promise<void> {
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
        if (channelInfo?.error !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }

        guild.channels[channel] = null;
        if (this.data.channels[channel] === undefined) {
            this.data.channels[channel] = {
                guildIds: {},
                count: 0,
                id: channelInfo.id
            };
            await this.subscribe(channelInfo.id, true);
        }
        this.data.channels[channel].guildIds[message.guild.id] = null;
        this.data.channels[channel].count++;
        message.channel.send("Notifications enabled for Twitch channel: " + channelInfo.displayName);
        return;
    }

    async unfollow(channel: string, message: Message): Promise<void> {
        const guild = this.data.guilds[message.guild.id];
        if (guild.channels[channel] === undefined) {
            message.channel.send("Notifications are not active for this channel.");
            return;
        }

        const channelInfo = await this.getChannelInfo(channel);
        if (channelInfo?.error !== undefined) {
            message.channel.send(channelInfo.error);
            return;
        }

        delete guild.channels[channel];
        delete this.data.channels[channel].guildIds[message.guild.id];
        this.data.channels[channel].count--;
        if (this.data.channels[channel].count === 0) {
            delete this.data.channels[channel];
            await this.subscribe(channelInfo.id, false);
        }
        message.channel.send("Notifications disabled for Twitch channel: " + channelInfo.displayName);
    }

    async searchChannel(channel: string): Promise<TwitchChannelInfo> {
        const options: RequestInit = {
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

    async getChannelInfo(channel: string): Promise<TwitchChannelInfo> {
        const options: RequestInit = {
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

    here(message: Message): void {
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
        } else {
            delete guild.chat;
            message.channel.send("Twitch notifications will no longer appear.");
        }

        return;
    }

    async subscribe(id: string, subscribe: boolean): Promise<string|undefined> {
        const url = BotUtils.getValue("url");
        const port = BotUtils.getValue("webhookPort");
        const options: RequestInit = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            },
            body: JSON.stringify(
                {
                    "hub.callback": `https://${url}:${port}/webhook/twitch`,
                    "hub.mode": subscribe ? "subscribe" : "unsubscribe",
                    "hub.topic": "https://api.twitch.tv/helix/streams?user_id=" + id,
                    "hub.lease_seconds": "864000"
                }
            ) 
        };
        const result = await this.call("https://api.twitch.tv/helix/webhooks/hub", options);
        if (!result.ok) {
            return "Could not send data to Twitch, try again later.";
        }
    }

    async renewFollows(): Promise<void> {
        const follows = await this.getFollows();
        this.cleanFollows(follows);
        for (const follow of follows) {
            this.subscribe(follow, true);
        }
    }

    async cleanFollows(keepFollows: string[]): Promise<void> {
        const keepFollowsSet = new Set(keepFollows);
        const removeCandidates: string[] = [];
        for (const channel in this.data.channels) {
            if (!keepFollowsSet.has(this.data.channels[channel].id)) {
                removeCandidates.push(channel);
            }
        }

        for (const channel in removeCandidates) {
            delete this.data.channels[channel];
            for (const guild in this.data.guilds) {
                delete this.data.guilds[guild].channels[channel];
            }
        }
    }

    async getFollows(): Promise<string[]> {
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Client-ID": this.clientId,
                "Authorization": "Bearer " + this.token
            }
        };
        const renewCandidates = [];
        let page;
        let result;
        const data = [];
        const date = new Date();
        date.setDate(date.getDate()+1);
        do {
            result = await (await this.call(`https://api.twitch.tv/helix/webhooks/subscriptions?first=100${page !== undefined ? "&after="+page : ""}`, options)).json();
            page = result.pagination.cursor;
            data.push(...result.data);
        } while (page !== undefined);

        for (const entry of data) {
            if (date > new Date(entry.expires_at)) {
                const id = entry.topic.substring(entry.topic.lastIndexOf("=")+1);
                renewCandidates.push(id);
            }
        }

        return renewCandidates;
    }

    async call(url: string, options: RequestInit, scopes?: string[], retry = true): Promise<Response> {
        const result = await fetch(url, options);
        if (result.ok || retry === false) {
            return result;
        }
        if (result.status === 401 || result.status === 402 || result.status === 403) {
            return this.authorize().then(() => this.call(url, options, scopes, retry = false));
        }
        return result;
    }

    async authorize(scopes = []): Promise<string> {
        const options: RequestInit = {
            method: "POST"
        };
        const url = new URL("https://id.twitch.tv/oauth2/token");
        const params: Params = {
            "client_id": BotUtils.getValue("twitchId"),
            "client_secret": BotUtils.getValue("twitchSecret"),
            "grant_type": "client_credentials",
        };
        if (scopes.length !== 0) params["scope"] = scopes.join(" ");
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const result = await (await fetch(url, options)).json();
        this.token = result.access_token;
        return result.access_token;
    }
}

export default new Twitch();