import React, { useMemo } from 'react';
import clsx from 'clsx';
import Message from './Message';
import PatchViewer from './PatchViewer';
import { processMessages } from '../helpers';
import './TrajectoryViewer.css';

const TrajectoryViewer = ({
  data,
  title = 'Agent Trajectory',
  variant = 'full',
  containerRef,
}) => {
  const processedMessages = useMemo(() => {
    if (!data?.messages) return [];
    return processMessages(data.messages);
  }, [data]);

  const patch = data.test_result?.git_patch;

  return (
    <div className={clsx('trajectory-wrapper', `trajectory-wrapper--${variant}`)}>
      <div className={clsx('trajectory-scroll', `trajectory-scroll--${variant}`)} ref={containerRef}>
        <div className="trajectory-container">
          <div className="viewer-header">
            <h1>{title}</h1>
            <div className="meta">
              Instance ID: <span className="id-tag">{data.instance_id}</span>
            </div>
          </div>

          <div className="messages-list">
            {processedMessages.map((msg, index) => (
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
