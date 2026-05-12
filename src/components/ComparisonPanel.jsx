import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen, Plus, X } from 'lucide-react';
import FileUploader from './FileUploader';
import TrajectoryViewer from './TrajectoryViewer';
import ScrollLockButton from './ScrollLockButton';
import TrajectorySidebar from './TrajectorySidebar';
import './ComparisonPanel.css';

const MotionAside = motion.aside;

const ComparisonPanel = ({
  isOpen,
  data,
  isDragActive,
  getRootProps,
  getInputProps,
  onClose,
  onReplaceClick,
  onResizeStart,
  onResizeKeyDown,
  panelWidth,
  panelWidthMin,
  panelWidthMax,
  scrollLocked,
  onToggleScroll,
  showScrollToggle,
  scrollRef,
  onFocus,
  trajectories = [],
  selectedIndex = 0,
  onSelectTrajectory,
  sidebarOpen = false,
  onToggleSidebar,
}) => {
  const rootProps = getRootProps({ className: 'comparison-panel' });
  const stopPanelClick = (event) => event.stopPropagation();

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionAside
          {...rootProps}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          style={{ '--comparison-panel-width': `${panelWidth}px` }}
        >
          <div
            className="comparison-panel__resize-handle"
            onPointerDown={onResizeStart}
            onKeyDown={onResizeKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-controls="comparison-panel-body"
            aria-label="Resize comparison panel"
            aria-valuemin={panelWidthMin}
            aria-valuemax={panelWidthMax}
            aria-valuenow={panelWidth}
            tabIndex={0}
          />
          <div className="comparison-panel__header">
            {showScrollToggle ? (
              <ScrollLockButton locked={scrollLocked} onClick={onToggleScroll} compact />
            ) : (
              <div className="comparison-panel__header-spacer" />
            )}
            <div className="comparison-panel__actions">
              {data && (
                <button
                  className="comparison-panel__icon-button"
                  onClick={(event) => {
                    stopPanelClick(event);
                    onReplaceClick();
                  }}
                  title="Replace comparison trajectory"
                  aria-label="Replace comparison trajectory"
                >
                  <FolderOpen size={18} />
                </button>
              )}
              <button
                className="comparison-panel__icon-button"
                onClick={(event) => {
                  stopPanelClick(event);
                  onClose();
                }}
                title="Close comparison panel"
                aria-label="Close comparison panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="comparison-panel__body" id="comparison-panel-body">
            <input {...getInputProps()} />
            {data ? (
              <>
                {trajectories.length > 1 && (
                  <TrajectorySidebar
                    trajectories={trajectories}
                    selectedIndex={selectedIndex}
                    onSelect={onSelectTrajectory}
                    isOpen={sidebarOpen}
                    onToggle={onToggleSidebar}
                  />
                )}
                <TrajectoryViewer
                  data={data}
                  showTitle={false}
                  containerRef={scrollRef}
                  variant="panel"
                  onFocus={onFocus}
                />
                {isDragActive && (
                  <div className="comparison-panel__drag-overlay">
                    Drop to replace comparison trajectory
                  </div>
                )}
              </>
            ) : (
              <FileUploader
                isDragActive={isDragActive}
                variant="panel"
                idleText="Drag 'n' drop a comparison JSON file here, or click to select one"
                activeText="Drop the comparison JSON file here ..."
              />
            )}
          </div>

          {!data && (
            <button
              className="comparison-panel__cta"
              onClick={(event) => {
                stopPanelClick(event);
                onReplaceClick();
              }}
              aria-label="Select comparison file"
            >
              <Plus size={16} />
              Select comparison file
            </button>
          )}
        </MotionAside>
      )}
    </AnimatePresence>
  );
};

export default ComparisonPanel;
