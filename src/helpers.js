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
