import { describe, it, expect } from 'vitest';
import { computeFacets, mergeFacets, soloFilterSet } from '../helpers';

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
    // A plain assistant reply: counted as a kind, not as a tool type.
    { role: 'assistant', content: 'all done' },
  ],
};

describe('computeFacets', () => {
  it('counts roles, plain replies and tool call types', () => {
    expect(computeFacets(trajectory)).toEqual({
      roles: { user: 1, system: 1, assistant: 2 },
      kinds: { reply: 1 },
      tools: { terminal: 2, think: 1 },
    });
  });

  it('classifies only tool-less assistant turns as replies', () => {
    const facets = computeFacets({
      messages: [
        { role: 'user', content: 'prompt' }, // a role, never a reply
        { role: 'assistant', content: 'plain' },
        { role: 'assistant', content: 'with calls', tool_calls: [{ function: { name: 'think' } }] },
        { role: 'assistant', content: 'empty calls', tool_calls: [] },
      ],
    });
    expect(facets.kinds.reply).toBe(2);
  });

  it('does not double count merged tool-role messages', () => {
    const facets = computeFacets(trajectory);
    // 3 tool results exist, but only the 3 calls on the assistant message count.
    expect(Object.values(facets.tools).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('tolerates missing or malformed data', () => {
    const empty = { roles: { user: 0, system: 0, assistant: 0 }, kinds: { reply: 0 }, tools: {} };
    expect(computeFacets(null)).toEqual(empty);
    expect(computeFacets({})).toEqual(empty);
    expect(computeFacets({ messages: [null, { role: 'assistant' }, { role: 'x' }] })).toEqual({
      roles: { user: 0, system: 0, assistant: 1 },
      kinds: { reply: 1 },
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
        assistant: { left: 2, right: 1 },
      },
      kinds: {
        reply: { left: 1, right: 0 },
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
    expect(merged.kinds.reply).toEqual({ left: 1, right: 0 });
  });
});

describe('soloFilterSet', () => {
  const facets = mergeFacets(computeFacets(trajectory), computeFacets(null));

  it('hides every other type when a tool is isolated', () => {
    expect(soloFilterSet(facets, 'tool:terminal')).toEqual(
      new Set(['role:user', 'role:system', 'kind:reply', 'tool:think'])
    );
  });

  it('hides every other type when a role is isolated', () => {
    expect(soloFilterSet(facets, 'role:user')).toEqual(
      new Set(['role:system', 'kind:reply', 'tool:terminal', 'tool:think'])
    );
  });

  it('hides every other type when plain replies are isolated', () => {
    expect(soloFilterSet(facets, 'kind:reply')).toEqual(
      new Set(['role:user', 'role:system', 'tool:terminal', 'tool:think'])
    );
  });

  it('never hides the assistant role: its turns are covered by tool and reply keys', () => {
    for (const key of ['role:user', 'role:system', 'kind:reply', 'tool:terminal', 'tool:think']) {
      expect(soloFilterSet(facets, key).has('role:assistant')).toBe(false);
    }
  });

  it('hides plain replies for every other solo, so "only this" stays literal', () => {
    expect(soloFilterSet(facets, 'tool:terminal').has('kind:reply')).toBe(true);
    expect(soloFilterSet(facets, 'role:user').has('kind:reply')).toBe(true);
  });

  it('keeps the isolated tool even when it is the only tool type', () => {
    const onlyTools = mergeFacets(
      computeFacets({ messages: [{ role: 'assistant', tool_calls: [{ function: { name: 'think' } }] }] }),
      computeFacets(null)
    );
    expect(soloFilterSet(onlyTools, 'tool:think')).toEqual(
      new Set(['role:user', 'role:system', 'kind:reply'])
    );
  });

  it('tolerates missing facets', () => {
    expect(soloFilterSet(null, 'tool:terminal')).toEqual(new Set());
  });
});
