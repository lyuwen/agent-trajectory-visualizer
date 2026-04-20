import React from 'react';
import { X } from 'lucide-react';
import './Notifications.css';

const Notifications = ({ notifications, onDismiss }) => {
  return (
    <div className="notifications-container">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notification ${n.fading ? 'fading' : ''}`}
        >
          <span className="notification-message">{n.message}</span>
          <button
            className="notification-close"
            onClick={() => onDismiss(n.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
