import React from 'react';
import { UploadCloud } from 'lucide-react';
import clsx from 'clsx';
import './FileUploader.css';

const FileUploader = ({
  isDragActive,
  variant = 'fullscreen',
  idleText = "Drag 'n' drop a JSON file here, or click to select one",
  activeText = 'Drop the JSON file here ...',
}) => {
  return (
    <div className={`uploader-container uploader-container--${variant}`}>
      <div className={clsx('dropzone', `dropzone--${variant}`, isDragActive && 'active')}>
        <UploadCloud size={variant === 'panel' ? 40 : 64} className="icon" />
        <p>{isDragActive ? activeText : idleText}</p>
      </div>
    </div>
  );
};

export default FileUploader;
