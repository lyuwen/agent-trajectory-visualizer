import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen } from 'lucide-react';
import FileUploader from './components/FileUploader';
import TrajectoryViewer from './components/TrajectoryViewer';
import Notifications from './components/Notifications';
import './App.css';

let notificationId = 0;

function App() {
  const [fileData, setFileData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const fileInputRef = useRef(null);

  const addNotification = useCallback((message) => {
    const id = ++notificationId;
    setNotifications((prev) => [...prev, { id, message, fading: false }]);

    setTimeout(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, fading: true } : n))
      );
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 500);
    }, 5000);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fading: true } : n))
    );
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 500);
  }, []);

  const handleFile = useCallback(
    (file) => {
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
