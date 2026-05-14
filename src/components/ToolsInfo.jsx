import React, { useState, useRef, useEffect } from 'react';
import './ToolsInfo.css';

function ToolsInfo({ tools }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredTool, setHoveredTool] = useState(null);
  const [lockedTool, setLockedTool] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [positionBelow, setPositionBelow] = useState(false);
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const tooltipRef = useRef(null);
  const toolItemRefs = useRef([]);

  // Handle edge cases: undefined, null, empty array
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return null;
  }

  const toolCount = tools.length;
  const isOpen = isHovered || isLocked;
  const activeToolIndex = lockedTool !== null ? lockedTool : hoveredTool;

  // Close popup when clicking outside (only if locked)
  useEffect(() => {
    if (!isLocked && lockedTool === null) return;

    const handleClickOutside = (event) => {
      const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(event.target);
      const clickedOutsidePopup = popupRef.current && !popupRef.current.contains(event.target);
      const clickedOutsideTooltip = tooltipRef.current && !tooltipRef.current.contains(event.target);

      if (clickedOutsideContainer && clickedOutsidePopup && clickedOutsideTooltip) {
        setIsLocked(false);
        setLockedTool(null);
        setHoveredTool(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLocked, lockedTool]);

  // Determine if popup should appear below instead of above
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // If less than 300px above and more space below, position below
    setPositionBelow(spaceAbove < 300 && spaceBelow > spaceAbove);
  }, [isOpen]);

  // Calculate tooltip position when hovering over a tool
  useEffect(() => {
    if (activeToolIndex === null || !toolItemRefs.current[activeToolIndex] || !popupRef.current) return;

    const toolItemRect = toolItemRefs.current[activeToolIndex].getBoundingClientRect();
    const popupRect = popupRef.current.getBoundingClientRect();

    // Position to the right of the popup pane
    const left = popupRect.right + 12;
    const top = toolItemRect.top;

    setTooltipPosition({ top, left });
  }, [activeToolIndex]);

  const handleClick = (e) => {
    e.stopPropagation();
    setIsLocked(!isLocked);
    if (isLocked) {
      setLockedTool(null);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleToolItemClick = (e, index) => {
    e.stopPropagation();
    // If clicking the same tool, unlock it; otherwise lock the new one
    if (lockedTool === index) {
      setLockedTool(null);
    } else {
      setLockedTool(index);
    }
  };

  const handleToolItemHover = (index) => {
    // Hovering over a different tool unsticks the previous one
    if (lockedTool !== null && lockedTool !== index) {
      setLockedTool(null);
    }
    setHoveredTool(index);
  };

  return (
    <span
      className="tools-info"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="tools-count" onClick={handleClick}>
        {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
      </span>
      {isOpen && (
        <div
          className={`tools-popup ${positionBelow ? 'below' : 'above'}`}
          ref={popupRef}
        >
          <div className="tools-list">
            {tools.map((tool, index) => {
              const toolName = tool?.function?.name || tool?.name || 'Unknown tool';

              return (
                <div
                  key={index}
                  className="tool-item"
                  ref={(el) => (toolItemRefs.current[index] = el)}
                  onMouseEnter={() => handleToolItemHover(index)}
                  onMouseLeave={() => setHoveredTool(null)}
                  onClick={(e) => handleToolItemClick(e, index)}
                >
                  <div className="tool-name">{toolName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeToolIndex !== null && isOpen && (
        <div
          className="tool-description-tooltip"
          ref={tooltipRef}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {tools[activeToolIndex]?.function?.description ||
           tools[activeToolIndex]?.description ||
           'No description available'}
        </div>
      )}
    </span>
  );
}

export default ToolsInfo;
