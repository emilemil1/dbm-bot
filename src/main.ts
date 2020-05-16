import BotManager from "discord-dbm";

const botManager = new BotManager();
botManager.start()
    .then(() => botManager.awaitCommands());