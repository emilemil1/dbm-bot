import Discord from "discord.js";
import Fuse from "fuse.js";
import fetch from "node-fetch";
class MTG {
    constructor() {
        this.configuration = {
            name: "Magic: The Gathering",
            description: "",
            commands: ["mtg"]
        };
        this.init();
    }
    async onCommand(command, message) {
        if (!(await this.init()) || command.length === 1) {
            return;
        }
        const commandParts = this.getCommandParts(command);
        if (commandParts.search === undefined)
            return;
        this.fuzzy(commandParts, message);
    }
    getCommandParts(command) {
        const commandParts = {};
        const setStart = command.findIndex(s => s.startsWith("("));
        const setEnd = command.findIndex(s => s.endsWith(")"));
        if (setStart !== -1 && setEnd !== -1 && setEnd >= setStart) {
            const results = this.sets.search(command.splice(setStart, (setEnd - setStart) + 1).join(" ").replace(/[()]/g, "").substring(0, 32));
            if (results.length !== 0) {
                commandParts.set = results[0];
            }
        }
        commandParts.search = command.splice(1).join(" ");
        return commandParts;
    }
    async fuzzy(commandParts, message) {
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
            const error = response;
            if (error.type !== "ambiguous") {
                return;
            }
            else {
                return this.extendSearch(commandParts, message);
            }
        }
        this.successResponse(response, message);
    }
    async extendSearch(commandParts, message) {
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
        if (response.status === 404)
            return;
        this.successResponse(response.data[0], message);
    }
    successResponse(card, message) {
        const footer = [];
        footer.push(this.getLegality(card.legalities));
        footer.push(card.prices.eur + " €");
        const embed = new Discord.RichEmbed()
            .setImage(card.image_uris.border_crop)
            .setAuthor(`${card.name} (${card.set.toUpperCase()})`, undefined, card.scryfall_uri)
            .setFooter(`${footer.filter(s => s !== undefined && s !== "").join(" • ")}`);
        message.channel.send(embed);
    }
    getLegality(legalities) {
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
    async init() {
        let ready = true;
        if (this.sets === undefined) {
            ready = ready && await this.getSets();
        }
        return ready;
    }
    async getSets() {
        const response = await (await fetch("https://api.scryfall.com/sets")).json();
        if (response.data === undefined) {
            return false;
        }
        const data = response.data;
        const setList = data
            .filter(set => !set.name.includes("Oversized"))
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
//# sourceMappingURL=mtg.js.map