// server/modules/llm/LLMClient.js

const { GeminiClient } = require('./GeminiClient');
const { OpenAIClient } = require('./OpenAIClient');

class LLMClient {
    constructor(config = {}) {
        this.config = config;
        this.defaultProvider = (config.defaultProvider || process.env.DEFAULT_PROVIDER || 'gemini').toLowerCase();
        this.clients = {};
    }

    getDefaultProvider() {
        return this.defaultProvider;
    }

    getClient(providerName) {
        const provider = (providerName || this.defaultProvider || 'gemini').toLowerCase();

        if (!this.clients[provider]) {
            if (provider === 'gemini') {
                this.clients[provider] = new GeminiClient(this.config.gemini || {});
            } else if (provider === 'openai') {
                this.clients[provider] = new OpenAIClient(this.config.openai || {});
            } else {
                throw new Error(`Unsupported LLM provider: ${provider}`);
            }
        }

        return { provider, client: this.clients[provider] };
    }

    async generate(request = {}) {
        const {
            provider: requestedProvider,
            jsonSchema,
            ...rest
        } = request || {};

        const { provider, client } = this.getClient(requestedProvider);

        let result;
        if (jsonSchema && typeof client.generateStructured === 'function') {
            result = await client.generateStructured({ ...rest, jsonSchema, agentName: rest.agentName });
        } else {
            result = await client.generateContent({ ...rest, agentName: rest.agentName });
        }

        return {
            provider,
            output: result.output,
            usage: result.usage || null
        };
    }
}

module.exports = { LLMClient };
