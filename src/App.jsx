import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen } from 'lucide-react';
import FileUploader from './components/FileUploader';
import TrajectoryViewer from './components/TrajectoryViewer';
import Notifications from './components/Notifications';
import './App.css';

const MAX_NOTIFICATIONS = 5;

function App() {
  const [fileData, setFileData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const fileInputRef = useRef(null);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const removeNotification = useCallback((id) => {
    const timers = timersRef.current.get(id);
    if (timers) {
      clearTimeout(timers.fade);
      clearTimeout(timers.remove);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const startFade = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fading: true } : n))
    );
    const removeTimer = setTimeout(() => removeNotification(id), 500);
    const existing = timersRef.current.get(id);
    if (existing) {
      timersRef.current.set(id, { ...existing, remove: removeTimer });
    }
  }, [removeNotification]);

  const addNotification = useCallback((message) => {
    const id = ++idRef.current;
    setNotifications((prev) => {
      const next = [...prev, { id, message, fading: false }];
      if (next.length > MAX_NOTIFICATIONS) {
        const evicted = next.slice(0, next.length - MAX_NOTIFICATIONS);
        for (const n of evicted) {
          const t = timersRef.current.get(n.id);
          if (t) {
            clearTimeout(t.fade);
            clearTimeout(t.remove);
            timersRef.current.delete(n.id);
          }
        }
        return next.slice(-MAX_NOTIFICATIONS);
      }
      return next;
    });

    const fadeTimer = setTimeout(() => startFade(id), 5000);
    timersRef.current.set(id, { fade: fadeTimer, remove: null });
  }, [startFade]);

  const dismissNotification = useCallback((id) => {
    const timers = timersRef.current.get(id);
    if (timers) clearTimeout(timers.fade);
    startFade(id);
  }, [startFade]);

  const handleFile = useCallback(
    (file) => {
      // Fallback check — some browsers don't enforce accept on <input type="file">
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        addNotification(`"${file.name}" is not a supported file type. Please drop a JSON file.`);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => addNotification(`Failed to read "${file.name}".`);
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          setFileData(json);
        } catch (err) {
          addNotification(`Failed to parse "${file.name}": ${err.message}`);
        }
      };
      reader.readAsText(file);
    },
    [addNotification]
  );

  const onDrop = useCallback(
    (accepted, rejected) => {
      if (rejected.length > 0 && accepted.length === 0) {
        const name = rejected[0]?.file?.name || 'file';
        addNotification(`"${name}" is not a supported file type. Please drop a JSON file.`);
        return;
      }
      if (accepted.length > 0) {
        handleFile(accepted[0]);
      }
    },
    [handleFile, addNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    noClick: !!fileData,
    noKeyboard: !!fileData,
    multiple: false,
  });

  const handleFabClick = (e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };
  const handleFabChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <>
      <div {...getRootProps()} className="app">
        <input {...getInputProps()} />

        {!fileData ? (
          <FileUploader isDragActive={isDragActive} />
        ) : (
          <>
            <TrajectoryViewer data={fileData} />
            {isDragActive && <div className="drag-overlay">Drop to replace trajectory</div>}
            <button className="fab" onClick={handleFabClick} title="Open a different trajectory">
              <FolderOpen size={22} />
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFabChange}
        style={{ display: 'none' }}
      />
      <Notifications notifications={notifications} onDismiss={dismissNotification} />
    </>
  );
}

export default App;
