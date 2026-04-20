import React from 'react';
import { UploadCloud } from 'lucide-react';
import clsx from 'clsx';
import './FileUploader.css';

const FileUploader = ({ isDragActive }) => {
  return (
    <div className="uploader-container">
      <div className={clsx('dropzone', isDragActive && 'active')}>
        <UploadCloud size={64} className="icon" />
        {isDragActive ? (
          <p>Drop the JSON file here ...</p>
        ) : (
          <p>Drag 'n' drop a JSON file here, or click to select one</p>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
