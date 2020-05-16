import { CommandModule, ModuleType } from "discord-dbm";
import Discord, { Message } from "discord.js";
import Fuse, { FuseOptions } from "fuse.js";
import fetch from "node-fetch";

interface CommandParts {
    search?: string;
    set?: string;
}

interface SetResponseObject {
    code: string;
    name: string;
    parent_set_code?: string;
    set_type: string;
}

interface CardLegalities {
    standard: string;
    pioneer: string;
    modern: string;
}

interface SearchResponseObject {
    name: string;
    prices: {
        eur?: string;
        usd?: string;
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

class MTG implements CommandModule {
    configuration = {
        name: "Magic: The Gathering",
        description: "",
        type: [ModuleType.command],
        commands: ["mtg"]
    }
    sets!: Fuse<unknown, FuseOptions<unknown>>

    constructor() {
        this.init();
    }

    async onCommand(command: string[], message: Message): Promise<void> {
        if (!(await this.init()) || command.length === 1) {
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
        if (setStart !== -1 && setEnd !== -1 && setEnd >= setStart) {
            const results = this.sets.search(command.splice(setStart, (setEnd - setStart) + 1).join(" ").replace(/[()]/g, "").substring(0,32)) as string[];
            if (results.length !== 0) {
                commandParts.set = results[0];
            }
        }
        
        commandParts.search = command.splice(1).join(" ");
        return commandParts;
    }

    private async fuzzy(commandParts: CommandParts, message: Message): Promise<void> {
        let url = "https://api.scryfall.com/cards/named?fuzzy=" + commandParts.search;
        if (commandParts.set) {
            url += "&set=" + commandParts.set;
        }

        const options = {
            headers: {
                "Cache-Control": "max'age=86400"
            }
        };
        const response = await (await fetch(url, options)).json();
        if (response.status === 404) {
            const error = response as ErrorResponseObject;
            if (error.type !== "ambiguous") {
                return;
            } else {
                return this.extendSearch(commandParts, message);
            }
        }

        this.successResponse(response, message);
    }

    private async extendSearch(commandParts: CommandParts, message: Message): Promise<void> {
        let url = "https://api.scryfall.com/cards/search?q=" + commandParts.search;
        if (commandParts.set) {
            url += "%20set:" + commandParts.set;
        }
        url += "&order=released";

        const options = {
            headers: {
                "Cache-Control": "max'age=86400"
            }
        };
        const response = await (await fetch(url, options)).json();
        if (response.status === 404) return;

        this.successResponse(response.data[0], message);
    }

    private successResponse(card: SearchResponseObject, message: Message): void {
        const footer = [];
        footer.push(this.getLegality(card.legalities));
        if (card.prices.eur !== null) {
            footer.push(card.prices.eur + " €");
        } else if (card.prices.usd !== null) {
            footer.push(card.prices.usd + " €");
        }
        

        const embed = new Discord.RichEmbed()
            .setImage(card.image_uris.border_crop)
            .setAuthor(`${card.name} (${card.set.toUpperCase()})`, undefined, card.scryfall_uri)
            .setFooter(`${footer.filter(s => s !== undefined && s !== "").join(" • ")}`);

        message.channel.send(embed);
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
        if (response.data === undefined) {
            return false;
        }
        const data = response.data as SetResponseObject[];
        const setList = data
            .filter(set => set.set_type !== "memorabilia")
            .filter(set => set.set_type !== "promo")
            .map(obj => {
                return {
                    code: obj.code,
                    name: obj.name,

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