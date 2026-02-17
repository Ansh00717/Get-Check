import React from 'react';

interface FolderUploadProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FolderUpload: React.FC<FolderUploadProps> = ({ onFileChange }) => {
  return (
    <div className="folder-anim-container">
      <div className="folder-anim-folder">
        <div className="front-side">
          <div className="tip"></div>
          <div className="cover"></div>
        </div>
        <div className="back-side cover"></div>
      </div>
      <label className="shimmer-upload-btn">
        <div className="shimmer-container">
          <div className="shimmer-bar"></div>
        </div>
        <span className="shimmer-upload-text">Upload Resume</span>
        <input 
            type="file" 
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
            onChange={onFileChange}
            style={{ display: 'none' }}
        />
      </label>
    </div>
  );
};