class Test {
    constructor() {
        this.configuration = {
            name: "Test Module",
            description: "",
            commands: ["test"]
        };
    }
    onCommand(command, message) {
        message.reply("Test!");
    }
}
export default new Test();
//# sourceMappingURL=test.js.map