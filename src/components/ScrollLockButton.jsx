import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import './ScrollLockButton.css';

const ScrollLockButton = ({ locked, onClick, compact = false }) => {
  return (
    <button
      className={`scroll-lock-button ${locked ? 'is-locked' : ''} ${compact ? 'scroll-lock-button--compact' : ''}`}
      onClick={onClick}
      title={locked ? 'Unlock scrolling' : 'Lock scrolling'}
      aria-label={locked ? 'Unlock scrolling' : 'Lock scrolling'}
      aria-pressed={locked}
    >
      {locked ? <Lock size={18} /> : <Unlock size={18} />}
      <span>{locked ? 'Scroll locked' : 'Independent scroll'}</span>
    </button>
  );
};

export default ScrollLockButton;
