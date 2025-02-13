const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const getGPT4js = require("gpt4js");

module.exports.routes = {
    name: "GPT-4o",
    desc: "Interact with GPT-4k using questions and id as your conversational Continues.",
    category: "AI Tools",
    query: "?ask=hi&id=1",
    usages: "/api/gpt4o",
    method: "get",
};

module.exports.onAPI = async (req, res) => {
    const ask = req.query.ask;
    const id = req.query.id;

    if (!ask || !id || isNaN(id)) {
        return res.status(400).json({ status: false, error: 'Both "ask" and "id" parameters are required and "id" must be a number' });
    }

    const numericId = Number(id);
    let messages = [];

    try {
        const data = await fs.readFile(`./${numericId}.json`, 'utf8');
        const parsedData = JSON.parse(data);
        messages = Array.isArray(parsedData.messages) ? parsedData.messages : [];
    } catch (error) {
        console.warn(`No previous conversation found for ID: ${numericId}. Initializing new conversation.`);
        messages = [
            { role: "system", content: "You're a math teacher." },
        ];
        await fs.writeFile(`./${numericId}.json`, JSON.stringify({ messages, lastInteraction: Date.now() }, null, 2));
    }

    messages.push({ role: "user", content: ask });

    const options = {
        provider: "Nextway",
        model: "gpt-4o-free",
        temperature: 0.5,
        webSearch: true,
    };

    try {
        const GPT4js = await getGPT4js();
        const provider = GPT4js.createProvider(options.provider);
        const response = await provider.chatCompletion(messages, options);

        messages.push({ role: "assistant", content: response });
        await fs.writeFile(`./${numericId}.json`, JSON.stringify({ messages, lastInteraction: Date.now() }, null, 2));
        res.json({ status: true, response });
    } catch (error) {
        console.error('Error during chat completion or file writing:', error);
        res.status(500).json({ status: false, error: 'Internal Server Error' });
    }
};

// Schedule cleanup for old JSON files every minute
cron.schedule('* * * * *', async () => {
    const directory = './';
    const files = await fs.readdir(directory);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    await Promise.all(files.map(async (file) => {
        if (path.extname(file) === '.json') {
            const data = await fs.readFile(path.join(directory, file), 'utf8');
            const parsedData = JSON.parse(data);
            const lastInteraction = parsedData.lastInteraction;

            if (lastInteraction < oneHourAgo) {
                await fs.unlink(path.join(directory, file));
                console.log(`Deleted old JSON file: ${file}`);
            }
        }
    }));
});
