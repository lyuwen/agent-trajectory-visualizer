import React, { useMemo } from 'react';
import clsx from 'clsx';
import Message from './Message';
import PatchViewer from './PatchViewer';
import { processMessages } from '../helpers';
import './TrajectoryViewer.css';

const TrajectoryViewer = ({
  data,
  title = 'Agent Trajectory',
  showTitle = true,
  variant = 'full',
  containerRef,
  onFocus,
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
              {' · '}
              <span className="turn-count">{assistantTurnCount} turns</span>
            </div>
          </div>

          <div className="messages-list">
            {messagesWithTurns.map((msg, index) => (
              <Message key={index} message={msg} />
            ))}
          </div>

          <PatchViewer patch={patch} />
        </div>
      </div>
    </div>
  );
};

export default TrajectoryViewer;
