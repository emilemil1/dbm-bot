import { BotUtils } from "discord-bot-manager";
import Reddit from "snoowrap";
class DankMeme {
    constructor() {
        this.configuration = {
            name: "Dank Memes",
            description: "",
            commands: ["dankmeme"]
        };
        this.reddit = new Reddit({
            userAgent: "A Discord bot using the Snoowrap npm package to display some dank memes.",
            clientId: BotUtils.getValue("redditClientId"),
            clientSecret: BotUtils.getSecret("redditClientSecret"),
            username: BotUtils.getValue("redditUsername"),
            password: BotUtils.getSecret("redditPassword")
        });
    }
    onCommand(command, message, attempt = 1) {
        if (attempt === 5) {
            message.channel.send("Oops. It seems we've run out of memes. (try again)");
        }
        this.reddit.getSubreddit("dankmemes").getRandomSubmission().then(submission => {
            switch (submission.url.substring(submission.url.lastIndexOf(".") + 1)) {
                case "jpg":
                case "jpeg":
                case "png":
                case "gif":
                case "webp":
                case "webm":
                case "mkv":
                case "mov":
                case "mp4":
                case "m4v":
                case "flv":
                case "avi":
                case "ogg":
                case "mp3":
                case "aac":
                case "flac":
                case "m4a":
                case "opus":
                case "wav":
                    break;
                default:
                    return this.onCommand(command, message, ++attempt);
            }
            message.channel.send("", {
                file: submission.url
            }).then(message => {
                if (command.includes("-t")) {
                    setTimeout(() => message.delete(), 60000);
                }
            });
        });
    }
}
export default new DankMeme();
//# sourceMappingURL=dankmeme.js.map