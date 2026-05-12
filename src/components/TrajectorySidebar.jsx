import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import './TrajectorySidebar.css';

const TrajectorySidebar = ({ trajectories, selectedIndex, onSelect, isOpen, onToggle }) => {
  return (
    <>
      <button
        className={clsx('sidebar-toggle', isOpen && 'sidebar-toggle--open')}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <div className={clsx('trajectory-sidebar', isOpen && 'trajectory-sidebar--open')}>
        <div className="sidebar-header">
          <h2>Trajectories</h2>
          <span className="sidebar-count">{trajectories.length}</span>
        </div>

        <div className="sidebar-list">
          {trajectories.map((traj, index) => (
            <button
              key={index}
              className={clsx(
                'sidebar-item',
                selectedIndex === index && 'sidebar-item--active'
              )}
              onClick={() => onSelect(index)}
            >
              <div className="sidebar-item-id">{traj.instance_id || `Trajectory ${index + 1}`}</div>
              <div className="sidebar-item-meta">
                {traj.messages?.length || 0} messages
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default TrajectorySidebar;
