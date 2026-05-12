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
