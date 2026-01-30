import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import TrajectoryViewer from './components/TrajectoryViewer';
import './App.css';

function App() {
  const [fileData, setFileData] = useState(null);

  return (
    <div className="app">
      {!fileData ? (
        <FileUploader onFileLoaded={setFileData} />
      ) : (
        <TrajectoryViewer data={fileData} />
      )}
    </div>
  );
}

export default App;
