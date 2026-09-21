import React, { useMemo } from 'react';
import clsx from 'clsx';
import Message from './Message';
import PatchViewer from './PatchViewer';
import ToolsInfo from './ToolsInfo';
import { processMessages } from '../helpers';
import './TrajectoryViewer.css';

const TrajectoryViewer = ({
  data,
  title = 'Agent Trajectory',
  showTitle = true,
  variant = 'full',
  containerRef,
  onFocus,
  hiddenFilters,
  expandSignal,
}) => {
  const processedMessages = useMemo(() => {
    if (!data?.messages) return [];
    return processMessages(data.messages);
  }, [data]);

  const assistantTurnCount = useMemo(() => {
    return processedMessages.filter(msg => msg.role === 'assistant').length;
  }, [processedMessages]);

  const messagesWithTurns = useMemo(() => {
    let assistantTurnCount = 0;

    return processedMessages.map((msg) => {
      if (msg.role === 'system') {
        return { ...msg, turnIndex: null };
      }

      if (msg.role === 'assistant') {
        assistantTurnCount++;
        return { ...msg, turnIndex: assistantTurnCount };
      }

      if (msg.role === 'user') {
        // User messages share the turn index with the next assistant message
        // If there's already been an assistant message, use the next turn number
        // Otherwise use turn 1
        const nextTurn = assistantTurnCount + 1;
        return { ...msg, turnIndex: nextTurn };
      }

      return msg;
    });
  }, [processedMessages]);

  const patch = data.test_result?.git_patch;

  // Apply the floating filter strip: a type is shown unless its chip is off.
  // A tool chip classifies the whole message, not just its cards: when every
  // call in a turn is filtered out the turn goes away instead of lingering as
  // a tool-less shell. A turn whose calls are only partly hidden stays, showing
  // just the surviving cards.
  const visibleMessages = useMemo(() => {
    if (!hiddenFilters || hiddenFilters.size === 0) return messagesWithTurns;

    return messagesWithTurns
      .map((msg) => {
        if (hiddenFilters.has(`role:${msg.role}`)) return null;

        const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        if (calls.length === 0) return { ...msg, tool_calls: calls };

        const toolCalls = calls.filter((tc) => !hiddenFilters.has(`tool:${tc?.function?.name}`));
        if (toolCalls.length === 0) return null;

        return { ...msg, tool_calls: toolCalls };
      })
      .filter(Boolean);
  }, [messagesWithTurns, hiddenFilters]);

  return (
    <div className={clsx('trajectory-wrapper', `trajectory-wrapper--${variant}`)}>
      <div
        className={clsx('trajectory-scroll', `trajectory-scroll--${variant}`)}
        ref={containerRef}
        tabIndex={0}
        onFocus={onFocus}
      >
        <div className="trajectory-container">
          <div className="viewer-header">
            {showTitle && <h1>{title}</h1>}
            <div className="meta">
              Instance ID: <span className="id-tag">{data.instance_id}</span>
              {data.tools && data.tools.length > 0 && (
                <>
                  {' · '}
                  <ToolsInfo tools={data.tools} />
                </>
              )}
              {' · '}
              <span className="turn-count">{assistantTurnCount} turns</span>
            </div>
          </div>

          <div className="messages-list">
            {visibleMessages.map((msg, index) => (
              <Message
                key={`${index}:${expandSignal?.token ?? 0}`}
                message={msg}
                expandSignal={expandSignal}
              />
            ))}
          </div>

          {visibleMessages.length === 0 && (
            <div className="filter-empty">
              Every message is filtered out — turn a type back on in the filter strip above.
            </div>
          )}

          <PatchViewer patch={patch} />
        </div>
      </div>
    </div>
  );
};

export default TrajectoryViewer;
