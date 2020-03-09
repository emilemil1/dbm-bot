import BotManager from "discord-bot-manager";

const botManager = new BotManager();
botManager
    .start()
    .then(() => botManager.awaitCommands());