import { Module } from "discord-dbm";
import { Message, RichEmbed } from "discord.js";
import Fuse, { FuseOptions } from "fuse.js";

interface CommandParts {
    search?: string;
    set?: string;
}

interface FuseResult {
    code: string;
}

interface SetResponseObject {
    code: string;
    name: string;
}

interface CardLegalities {
    standard: string;
    pioneer: string;
    modern: string;
}

interface SearchResponseObject {
    name: string;
    prices: {
        eur: string;
    };
    legalities: CardLegalities;
    set: string;
    scryfall_uri: string;
    image_uris: {
        border_crop: string;
    };
}

interface ErrorResponseObject {
    type: string;
}

class MTG implements Module {
    configuration = {
        name: "Magic: The Gathering",
        description: "",
        commands: ["mtg"]
    }
    sets!: Fuse<unknown, FuseOptions<unknown>>

    constructor() {
        this.init();
    }

    async onCommand(command: string[], message: Message): Promise<void> {
        if (await this.init() || command.length === 1) {
            return;
        }
        const commandParts = this.getCommandParts(command);
        if (commandParts.search === undefined) return;

        this.fuzzy(commandParts, message);
    }

    private getCommandParts(command: string[]): CommandParts {
        const commandParts: CommandParts = {};

        const setStart = command.findIndex(s => s.startsWith("("));
        const setEnd = command.findIndex(s => s.endsWith(")"));
        if (setStart !== -1 && setEnd !== -1) {
            const results = this.sets.search(command.splice(setStart, setEnd).join(" ").substring(0,32)) as FuseResult[];
            if (results.length !== 0) {
                commandParts.set = results[0].code;
            } 
        }
        
        commandParts.search = command.join(" ");
        return commandParts;
    }

    private async fuzzy(commandParts: CommandParts, message: Message): Promise<void> {
        let url = "https://api.scryfall.com/cards/named?fuzzy=" + commandParts.search;
        if (commandParts.set) {
            url += "?set=" + commandParts.set;
        }

        const headers = new Headers();
        headers.append("Cache-Control", "max'age=86400");
        const request = new Request(url, {
            headers
        });
        const response = await (await fetch(request)).json();

        if (response.status === 404) {
            const data = response.data as ErrorResponseObject;
            if (data.type !== "ambiguous") {
                return;
            } else {
                return this.extendSearch(commandParts, message);
            }
        }

        this.successResponse(response.data, message);
    }

    private async extendSearch(commandParts: CommandParts, message: Message): Promise<void> {
        let url = "https://api.scryfall.com/cards/search?q=" + commandParts.search;
        if (commandParts.set) {
            url += "%20set:" + commandParts.set;
        }
        url += "&order=released";

        const headers = new Headers();
        headers.append("Cache-Control", "max'age=86400");
        const request = new Request(url, {
            headers
        });
        const response = await (await fetch(request)).json();

        if (response.status === 404) return;

        this.successResponse(response.data, message);
    }

    private successResponse(card: SearchResponseObject, message: Message): void {
        const embed = new RichEmbed()
            .setImage(card.image_uris.border_crop)
            .setAuthor(`${card.name} (${card.set.toUpperCase()})`, undefined, card.scryfall_uri)
            .setFooter(`${this.getLegality(card.legalities)}${card.prices.eur ? "• €" + card.prices.eur : ""}`);

        message.channel.sendEmbed(embed);
    }

    private getLegality(legalities: SearchResponseObject["legalities"]): string {
        const results = [];
        if (legalities.standard === "legal") {
            results.push("STA");
        }
        if (legalities.pioneer === "legal") {
            results.push("PIO");
        }
        if (legalities.modern === "legal") {
            results.push("MOD");
        }
        return results.join();
    }

    private async init(): Promise<boolean> {
        let ready = true;
        if (this.sets === undefined) {
            ready = ready && await this.getSets();
        }
        return ready;
    }

    private async getSets(): Promise<boolean> {
        const response = await (await fetch("https://api.scryfall.com/sets")).json();
        if (response.status !== 200) {
            return false;
        }
        const data = (await response.json()).data as SetResponseObject[];
        const setList = data.map(obj => {
            return {
                code: obj.code,
                name: obj.name
            };
        });
        this.sets = new Fuse(setList, {
            id: "code",
            shouldSort: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            keys: ["name", "code"]
        });
        return true;
    }
}

export default new MTG();