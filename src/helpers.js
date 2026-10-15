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

/**
 * Count message roles, plain assistant replies, and tool call types in a
 * trajectory, for the filter strip.
 * Counts raw messages: tool-role messages are excluded because processMessages()
 * merges them into the assistant tool_calls that are counted here.
 * @param {object|null|undefined} data - Normalized trajectory
 * @returns {{roles: Object<string, number>, kinds: Object<string, number>, tools: Object<string, number>}}
 */
export function computeFacets(data) {
  const roles = { user: 0, system: 0, assistant: 0 };
  const kinds = { reply: 0 };
  const tools = {};

  const messages = Array.isArray(data?.messages) ? data.messages : [];

  for (const msg of messages) {
    if (!msg || msg.role === 'tool') continue;

    if (Object.prototype.hasOwnProperty.call(roles, msg.role)) {
      roles[msg.role] += 1;
    }

    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

    // An assistant turn with no tool calls belongs to no tool type, so it needs
    // its own key to be hideable on its own instead of riding along with the
    // role chips.
    if (msg.role === 'assistant' && calls.length === 0) {
      kinds.reply += 1;
    }

    for (const call of calls) {
      const name = call?.function?.name;
      if (!name) continue;
      tools[name] = (tools[name] ?? 0) + 1;
    }
  }

  return { roles, kinds, tools };
}

/**
 * Merge two facet counts into per-pane values for the filter strip.
 * @param {{roles: object, kinds: object, tools: object}} left
 * @param {{roles: object, kinds: object, tools: object}} right
 * @returns {{roles: Object<string, {left: number, right: number}>, kinds: Object<string, {left: number, right: number}>, tools: Object<string, {left: number, right: number}>}}
 */
export function mergeFacets(left, right) {
  const pair = (a, b) => ({ left: a ?? 0, right: b ?? 0 });

  const mergeBucket = (bucket) => {
    const merged = {};
    const keys = new Set([
      ...Object.keys(left?.[bucket] ?? {}),
      ...Object.keys(right?.[bucket] ?? {}),
    ]);
    for (const key of keys) {
      merged[key] = pair(left?.[bucket]?.[key], right?.[bucket]?.[key]);
    }
    return merged;
  };

  return {
    roles: mergeBucket('roles'),
    kinds: mergeBucket('kinds'),
    tools: mergeBucket('tools'),
  };
}

/**
 * Build the hidden-filter set that shows a single type and hides every other
 * filterable one — the "show only this" counterpart of a plain toggle.
 *
 * `role:assistant` is never added: assistant turns are covered by the tool keys
 * of the calls they make, and a turn that calls nothing is a `kind:reply`.
 *
 * @param {{roles: object, kinds: object, tools: object}} facets - Counts from mergeFacets()
 * @param {string} key - Filter key to keep visible, e.g. "tool:terminal"
 * @returns {Set<string>} Keys to hide
 */
export function soloFilterSet(facets, key) {
  const next = new Set();

  for (const role of Object.keys(facets?.roles ?? {})) {
    if (role === 'assistant') continue;
    const roleKey = `role:${role}`;
    if (roleKey !== key) next.add(roleKey);
  }

  for (const kind of Object.keys(facets?.kinds ?? {})) {
    const kindKey = `kind:${kind}`;
    if (kindKey !== key) next.add(kindKey);
  }

  for (const name of Object.keys(facets?.tools ?? {})) {
    const toolKey = `tool:${name}`;
    if (toolKey !== key) next.add(toolKey);
  }

  return next;
}

/**
 * Build the hidden-filter set that shows only the given tool types — the
 * many-key counterpart of soloFilterSet(), used for "show only the tool calls
 * of the focused message" where one turn can carry several tool types.
 *
 * Like soloFilterSet(), `role:assistant` is never hidden: assistant turns
 * survive on the strength of their tool keys, and a turn whose calls are all
 * hidden drops out in TrajectoryViewer.
 *
 * @param {{roles: object, kinds: object, tools: object}} facets - Counts from mergeFacets()
 * @param {Iterable<string>} names - Tool names to keep visible
 * @returns {Set<string>} Keys to hide
 */
export function soloToolsFilterSet(facets, names) {
  const keep = new Set();
  for (const name of names ?? []) {
    if (name) keep.add(`tool:${name}`);
  }

  const next = new Set();

  for (const role of Object.keys(facets?.roles ?? {})) {
    if (role === 'assistant') continue;
    next.add(`role:${role}`);
  }

  for (const kind of Object.keys(facets?.kinds ?? {})) {
    next.add(`kind:${kind}`);
  }

  for (const name of Object.keys(facets?.tools ?? {})) {
    const toolKey = `tool:${name}`;
    if (!keep.has(toolKey)) next.add(toolKey);
  }

  return next;
}

/**
 * Filter markdown content to a plain string.
 * @param {string|Array|null|undefined} content
 * @returns {string|null|undefined}
 */
function normalizeMessageContent(content) {
    if (!content) return content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter(part => part && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n');
    }
    return content;
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
            const newMsg = { ...msg, content: normalizeMessageContent(msg.content) };
            newMsg.tool_calls = newMsg.tool_calls.map(tc => {
                const output = toolOutputs.get(tc.id);
                return {
                    ...tc,
                    output: output
                        ? { ...output, content: normalizeMessageContent(output.content) }
                        : output,
                };
            });
            processed.push(newMsg);
        } else {
            processed.push({ ...msg, content: normalizeMessageContent(msg.content) });
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
