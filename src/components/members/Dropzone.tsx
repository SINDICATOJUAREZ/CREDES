'use client';

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropzoneProps {
  onFileAccepted: (file: File) => void;
  loading?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileAccepted, loading }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setFileName(file.name);
      onFileAccepted(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileAccepted(file);
    }
  };

  return (
    <div className="w-full">
      <label 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'}
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <AnimatePresence mode="wait">
            {!fileName ? (
              <motion.div 
                key="empty"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="p-4 bg-blue-100 rounded-full mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <p className="mb-2 text-sm text-gray-700 font-semibold">
                  Click para subir o arrastra tu archivo Excel
                </p>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">XLSX, XLS</p>
              </motion.div>
            ) : (
              <motion.div 
                key="file"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="p-4 bg-green-100 rounded-full mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                </div>
                <p className="mb-2 text-sm text-green-700 font-bold max-w-xs truncate">{fileName}</p>
                <div className="flex items-center text-xs text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" /> Archivo cargado correctamente
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".xlsx, .xls" 
          onChange={handleFileInput}
          disabled={loading}
        />
      </label>
    </div>
  );
};
