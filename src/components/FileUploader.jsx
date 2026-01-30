import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import clsx from 'clsx';
import './FileUploader.css';

const FileUploader = ({ onFileLoaded }) => {
  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onabort = () => console.log('file reading was aborted');
      reader.onerror = () => console.log('file reading has failed');
      reader.onload = () => {
        try {
          const binaryStr = reader.result;
          const json = JSON.parse(binaryStr);
          onFileLoaded(json);
        } catch (err) {
            console.error("Failed to parse JSON", err);
            alert("Failed to parse JSON file");
        }
      };
      reader.readAsText(file);
    });
  }, [onFileLoaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'application/json': ['.json']} });

  return (
    <div className="uploader-container">
      <div 
        {...getRootProps()} 
        className={clsx(
          "dropzone",
          isDragActive && "active"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud size={64} className="icon" />
        {
          isDragActive ?
            <p>Drop the JSON file here ...</p> :
            <p>Drag 'n' drop a JSON file here, or click to select one</p>
        }
      </div>
    </div>
  );
};

export default FileUploader;
