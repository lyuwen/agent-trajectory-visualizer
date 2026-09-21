import { describe, it, expect } from 'vitest';
import { computeFacets, mergeFacets } from '../helpers';

const trajectory = {
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
    {
      role: 'assistant',
      content: 'working',
      tool_calls: [
        { id: 'a', function: { name: 'terminal', arguments: '{}' } },
        { id: 'b', function: { name: 'terminal', arguments: '{}' } },
        { id: 'c', function: { name: 'think', arguments: '{}' } },
      ],
    },
    { role: 'tool', tool_call_id: 'a', content: 'out' },
    { role: 'tool', tool_call_id: 'b', content: 'out' },
    { role: 'tool', tool_call_id: 'c', content: 'out' },
  ],
};

describe('computeFacets', () => {
  it('counts roles and tool call types', () => {
    expect(computeFacets(trajectory)).toEqual({
      roles: { user: 1, system: 1, assistant: 1 },
      tools: { terminal: 2, think: 1 },
    });
  });

  it('does not double count merged tool-role messages', () => {
    const facets = computeFacets(trajectory);
    // 3 tool results exist, but only the 3 calls on the assistant message count.
    expect(Object.values(facets.tools).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('tolerates missing or malformed data', () => {
    expect(computeFacets(null)).toEqual({ roles: { user: 0, system: 0, assistant: 0 }, tools: {} });
    expect(computeFacets({})).toEqual({ roles: { user: 0, system: 0, assistant: 0 }, tools: {} });
    expect(computeFacets({ messages: [null, { role: 'assistant' }, { role: 'x' }] })).toEqual({
      roles: { user: 0, system: 0, assistant: 1 },
      tools: {},
    });
  });
});

describe('mergeFacets', () => {
  it('pairs counts per pane and keeps types unique to one pane', () => {
    const left = computeFacets(trajectory);
    const right = computeFacets({
      messages: [
        { role: 'user', content: 'other' },
        { role: 'assistant', tool_calls: [{ function: { name: 'finish', arguments: '{}' } }] },
      ],
    });

    expect(mergeFacets(left, right)).toEqual({
      roles: {
        user: { left: 1, right: 1 },
        system: { left: 1, right: 0 },
        assistant: { left: 1, right: 1 },
      },
      tools: {
        terminal: { left: 2, right: 0 },
        think: { left: 1, right: 0 },
        finish: { left: 0, right: 1 },
      },
    });
  });

  it('handles an absent right pane', () => {
    const merged = mergeFacets(computeFacets(trajectory), computeFacets(null));
    expect(merged.tools.terminal).toEqual({ left: 2, right: 0 });
    expect(merged.roles.user).toEqual({ left: 1, right: 0 });
  });
});
