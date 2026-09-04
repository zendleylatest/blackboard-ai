import OpenAI from "openai";

let cachedClient = null;
let cachedApiKey = null;

const getTimeoutMs = () => {
    const seconds = Number(process.env.OPENAI_TIMEOUT_S || 40);
    return Math.max(1, seconds) * 1000;
};

export const getOpenAIClient = (apiKey = process.env.OPENAI_API_KEY) => {
    if (!apiKey) {
        throw new Error(
            "OPENAI_API_KEY is not set. Add it to the Node environment."
        );
    }

    if (!cachedClient || cachedApiKey !== apiKey) {
        cachedClient = new OpenAI({
            apiKey,
            timeout: getTimeoutMs(),
        });
        cachedApiKey = apiKey;
    }

    return cachedClient;
};

export const getVectorStoresApi = (client) => {
    if (client?.vectorStores) return client.vectorStores;
    if (client?.beta?.vectorStores) return client.beta.vectorStores;
    throw new Error(
        "OpenAI SDK does not expose a compatible vector stores API."
    );
};

export const getOpenAIModel = () => (
    process.env.OPENAI_MODEL || "gpt-4o-mini"
);

export const getOpenAIGatingModel = () => (
    process.env.OPENAI_GATING_MODEL || getOpenAIModel()
);
