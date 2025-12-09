// server/modules/llm/OpenAIClient.js

/**
 * OpenAI Client using the Responses API (recommended for analysis tasks)
 * The Responses API provides better reasoning performance, lower costs, and stateful conversations
 * compared to Chat Completions, making it ideal for document analysis workflows.
 */
class OpenAIClient {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || null;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.defaultModel = config.defaultModel || process.env.DEFAULT_OPENAI_MODEL || 'gpt-5.1';
        this.lastUsage = null;
    }

    /**
     * Recursively ensure OpenAI Responses API compliance:
     * 1. Add additionalProperties: false to all object schemas
     * 2. Ensure all properties are listed in required array
     * Required by OpenAI Responses API for strict JSON schema validation
     */
    ensureStrictSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return schema;
        }

        const processedSchema = { ...schema };

        // Process object type schemas
        if (processedSchema.type === 'object') {
            // Add additionalProperties: false if not present
            if (!('additionalProperties' in processedSchema)) {
                processedSchema.additionalProperties = false;
            }

            // Ensure all properties are in the required array
            if (processedSchema.properties && typeof processedSchema.properties === 'object') {
                const propertyKeys = Object.keys(processedSchema.properties);
                const currentRequired = processedSchema.required || [];
                // Add any missing properties to required array
                processedSchema.required = Array.from(new Set([...currentRequired, ...propertyKeys]));
            }
        }

        // Recursively process nested properties
        if (processedSchema.properties && typeof processedSchema.properties === 'object') {
            processedSchema.properties = {};
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                processedSchema.properties[key] = this.ensureStrictSchema(propSchema);
            }
        }

        // Recursively process array items
        if (processedSchema.items) {
            processedSchema.items = this.ensureStrictSchema(processedSchema.items);
        }

        // Recursively process oneOf, anyOf, allOf
        if (processedSchema.oneOf && Array.isArray(processedSchema.oneOf)) {
            processedSchema.oneOf = processedSchema.oneOf.map(s => this.ensureStrictSchema(s));
        }
        if (processedSchema.anyOf && Array.isArray(processedSchema.anyOf)) {
            processedSchema.anyOf = processedSchema.anyOf.map(s => this.ensureStrictSchema(s));
        }
        if (processedSchema.allOf && Array.isArray(processedSchema.allOf)) {
            processedSchema.allOf = processedSchema.allOf.map(s => this.ensureStrictSchema(s));
        }

        return processedSchema;
    }

    ensureApiKey() {
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
    }

    isReasoningModel(modelName = '') {
        const reasoningModels = ['gpt-5.1', 'gpt-5-thinking', 'o3', 'o3-mini', 'o1'];
        return reasoningModels.some((name) => modelName.includes(name));
    }

    async generateContent(options = {}) {
        return this.createResponse({ ...options, structured: false });
    }

    async generateStructured(options = {}) {
        if (!options.jsonSchema) {
            throw new Error('jsonSchema is required for structured OpenAI requests');
        }
        return this.createResponse({ ...options, structured: true });
    }

    async createResponse(options = {}) {
        this.ensureApiKey();

        const {
            prompt,
            systemInstruction,
            jsonSchema,
            model,
            maxOutputTokens = 16000,
            reasoningEffort = 'medium',
            verbosity = 'low',   
            agentName = 'OpenAIClient'
        } = options;

        if (!prompt) {
            throw new Error('Prompt is required for OpenAI requests');
        }

        const selectedModel = model || this.defaultModel;
        const useReasoning = this.isReasoningModel(selectedModel);

        // Build input array with system instruction as developer role (Responses API pattern)
        const input = [];

        if (systemInstruction) {
            input.push({
                role: 'developer',
                content: systemInstruction
            });
        }

        input.push({
            role: 'user',
            content: prompt
        });

        const payload = {
            model: selectedModel,
            input: input,
            max_output_tokens: maxOutputTokens  // Responses API uses max_output_tokens, not max_completion_tokens
        };

        // Add structured output if schema provided (text.format instead of response_format)
        if (jsonSchema) {
            // Ensure schema has additionalProperties: false for OpenAI strict validation
            const strictSchema = this.ensureStrictSchema(jsonSchema);
            payload.text = {
                format: {
                    type: 'json_schema',
                    name: 'analysis_result',
                    strict: true,
                    schema: strictSchema
                },
                verbosity: verbosity  // Controls response length (low/medium/high)
            };
        } else {
            payload.text = {
                verbosity: verbosity
            };
        }

        // Add reasoning configuration for reasoning models
        if (useReasoning) {
            payload.reasoning = {
                effort: reasoningEffort  // Controls reasoning depth (low/medium/high)
            };
            console.log(`[${agentName}] OpenAI reasoning mode -> effort: ${reasoningEffort}, verbosity: ${verbosity}`);
        }

        const response = await fetch(`${this.baseURL}/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI Responses API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Check if response was truncated
        if (data.status === 'incomplete' || data.incomplete_details) {
            console.warn(`[${agentName}] ⚠️ Response incomplete: ${JSON.stringify(data.incomplete_details)}`);
        }

        // Parse token usage from Responses API response
        this.lastUsage = {
            promptTokens: data?.usage?.input_tokens ?? 0,
            completionTokens: data?.usage?.output_tokens ?? 0,
            totalTokens: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
            reasoningTokens: data?.usage?.reasoning_tokens ?? 0
        };

        console.log(`[${agentName}] OpenAI token usage -> prompt: ${this.lastUsage.promptTokens}, completion: ${this.lastUsage.completionTokens}, reasoning: ${this.lastUsage.reasoningTokens}`);

        // Extract completion from OpenAI Responses API response
        let completion;

        // New Responses API returns output array with reasoning and message blocks
        if (Array.isArray(data?.output)) {
            // Find the message block (which contains the actual response text)
            const messageBlock = data.output.find(block => block.type === 'message');
            if (messageBlock && messageBlock.content !== undefined) {
                // Content might be a string or an array of content objects
                if (typeof messageBlock.content === 'string') {
                    completion = messageBlock.content;
                } else if (Array.isArray(messageBlock.content)) {
                    // If it's an array, concatenate text from all parts
                    // OpenAI API uses 'output_text' type for text content
                    completion = messageBlock.content
                        .filter(part => part.type === 'output_text')
                        .map(part => part.text)
                        .join('');
                }
            }
        }

        // Fallback to output_text (for older API versions)
        if (!completion && data?.output_text) {
            completion = data.output_text;
            console.log(`[${agentName}] Using legacy output_text`);
        }

        // Fallback to text.content (for structured output)
        if (!completion && data?.text?.content) {
            completion = data.text.content;
            console.log(`[${agentName}] Using structured output from text.content`);
        }

        if (!completion) {
            console.error(`[${agentName}] Response data:`, JSON.stringify(data, null, 2).substring(0, 500));
            throw new Error('OpenAI Responses API returned an empty response');
        }

        // If structured output was requested (jsonSchema present), parse the JSON string
        let output = completion;
        if (jsonSchema) {
            console.log(`[${agentName}] 📄 Raw completion (first 500 chars): ${completion.substring(0, 500)}`);
            console.log(`[${agentName}] 📄 Raw completion (last 200 chars): ${completion.slice(-200)}`);
            console.log(`[${agentName}] 📏 Completion length: ${completion.length} chars`);

            try {
                output = JSON.parse(completion);
                console.log(`[${agentName}] ✓ Parsed structured JSON output`);
                console.log(`[${agentName}] ✓ Parsed output keys: ${Object.keys(output).join(', ')}`);
            } catch (parseError) {
                console.warn(`[${agentName}] ⚠ Failed to parse JSON output: ${parseError.message}`);
                console.log(`[${agentName}] Tokens used: ${this.lastUsage.completionTokens} / ${maxOutputTokens} max`);
                // Return as string if parsing fails
                output = completion;
            }
        }

        return {
            output,
            usage: this.lastUsage
        };
    }
}

module.exports = { OpenAIClient };
