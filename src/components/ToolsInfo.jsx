import React from 'react';
import './ToolsInfo.css';

function ToolsInfo({ tools }) {
  // Handle edge cases: undefined, null, empty array
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return null;
  }

  const toolCount = tools.length;

  return (
    <span className="tools-info">
      <span className="tools-count">{toolCount} {toolCount === 1 ? 'tool' : 'tools'}</span>
      <div className="tools-tooltip">
        <div className="tools-list">
          {tools.map((tool, index) => {
            // Handle malformed tool objects
            const toolName = tool?.function?.name || tool?.name || 'Unknown tool';
            const toolDesc = tool?.function?.description || tool?.description || 'No description available';

            // Truncate description if longer than 200 characters
            const displayDesc = toolDesc.length > 200
              ? toolDesc.substring(0, 200) + '...'
              : toolDesc;

            return (
              <div key={index} className="tool-item">
                <div className="tool-name">{toolName}</div>
                <div className="tool-description">{displayDesc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </span>
  );
}

export default ToolsInfo;
