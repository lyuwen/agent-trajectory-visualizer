/**
 * Detect if a parsed JSON object is an ATIF trajectory (v1.5–v1.8).
 * @param {object} data - Parsed JSON object
 * @returns {boolean}
 */
export function isATIF(data) {
    return (
        data !== null &&
        typeof data === 'object' &&
        typeof data.schema_version === 'string' &&
        data.schema_version.startsWith('ATIF-') &&
        Array.isArray(data.steps)
    );
}

/**
 * Extract plain text from an ATIF message field.
 * v1.5: string
 * v1.6+: ContentPart[] — parts with type "text", "image", or (v1.8+) "audio"
 * @param {string|Array} message
 * @returns {string}
 */
function extractATIFMessageText(message) {
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
        return message
            .filter(part => part && part.type === 'text')
            .map(part => part.text || '')
            .join('\n');
    }
    return '';
}

/**
 * Normalize an ATIF trajectory (v1.5–v1.8) into the internal format
 * expected by processMessages() and the rendering components.
 *
 * ATIF keeps tool results bundled on the same step via observation.results;
 * we emit synthetic role:"tool" messages so processMessages can merge them
 * exactly as it does for the standard OpenAI-style format.
 *
 * @param {object} data - Parsed ATIF object
 * @returns {object} Normalized trajectory with a .messages array
 */
export function normalizeATIF(data) {
    const messages = [];

    for (const step of data.steps) {
        const role =
            step.source === 'agent'  ? 'assistant' :
            step.source === 'system' ? 'system' :
            'user';

        const content = extractATIFMessageText(step.message);
        const msg = { role, content };

        if (step.reasoning_content) {
            msg.reasoning_content = step.reasoning_content;
        }

        // Agent steps may carry tool calls whose results sit in observation.results
        if (role === 'assistant' && Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
            msg.tool_calls = step.tool_calls.map(tc => ({
                id: tc.tool_call_id,
                type: 'function',
                function: {
                    name: tc.function_name,
                    // ToolCall.jsx expects a JSON string; ATIF stores an object
                    arguments: typeof tc.arguments === 'string'
                        ? tc.arguments
                        : JSON.stringify(tc.arguments),
                },
            }));

            messages.push(msg);

            // Emit one synthetic tool message per result so processMessages merges them
            if (step.observation && Array.isArray(step.observation.results)) {
                for (const result of step.observation.results) {
                    const resultContent = typeof result.content === 'string'
                        ? result.content
                        : JSON.stringify(result.content);
                    messages.push({
                        role: 'tool',
                        tool_call_id: result.source_call_id,
                        content: resultContent,
                    });
                }
            }
        } else {
            messages.push(msg);
        }
    }

    return {
        ...data,
        // Map ATIF identifiers to the fields TrajectoryViewer reads
        instance_id: data.session_id || data.trajectory_id || '',
        tools: data.agent?.tool_definitions ?? [],
        messages,
        _atif: true,
    };
}

export function processMessages(messages) {
    const toolOutputs = new Map();

    // Index tool outputs by tool_call_id
    messages.forEach(msg => {
        if (msg.role === 'tool') {
            toolOutputs.set(msg.tool_call_id, msg);
        }
    });

    // Build processed list
    const processed = [];
    messages.forEach(msg => {
        // We skip independent tool messages as they are attached to the assistant message
        if (msg.role === 'tool') return;

        if (msg.role === 'assistant' && msg.tool_calls) {
            // Clone message to avoid mutation
            const newMsg = { ...msg };
            newMsg.tool_calls = newMsg.tool_calls.map(tc => ({
                ...tc,
                output: toolOutputs.get(tc.id)
            }));
            processed.push(newMsg);
        } else {
            processed.push(msg);
        }
    });

    return processed;
}

/**
 * Parse JSONL content into an array of trajectory objects.
 * Each line should be a complete JSON object.
 * @param {string} content - The JSONL file content
 * @returns {Array} Array of parsed trajectory objects
 */
export function parseJSONL(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const trajectories = [];

    for (let i = 0; i < lines.length; i++) {
        try {
            const parsed = JSON.parse(lines[i]);
            trajectories.push(parsed);
        } catch (err) {
            throw new Error(`Failed to parse line ${i + 1}: ${err.message}`);
        }
    }

    return trajectories;
}

/**
 * Detect if content is JSONL (multiple lines with JSON objects)
 * or single JSON object.
 * @param {string} content - File content
 * @returns {boolean} true if JSONL, false if single JSON
 */
export function isJSONL(content) {
    const trimmed = content.trim();
    const lines = trimmed.split('\n').filter(line => line.trim());

    // Single line or starts with { and ends with } = likely single JSON
    if (lines.length === 1) {
        return false;
    }

    // Multiple lines where each starts with { = likely JSONL
    return lines.every(line => line.trim().startsWith('{'));
}
