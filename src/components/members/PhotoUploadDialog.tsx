'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RefreshCw, Check, X, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";

interface PhotoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCapture: (photoUrl: string) => void;
  currentPhoto?: string;
}

export const PhotoUploadDialog: React.FC<PhotoUploadDialogProps> = ({ 
  isOpen, 
  onClose, 
  onPhotoCapture,
  currentPhoto 
}) => {
  const [mode, setMode] = useState<'options' | 'camera' | 'upload'>('options');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const savedDeviceId = localStorage.getItem('preferredCameraId');
      if (savedDeviceId) setSelectedDeviceId(savedDeviceId);
      
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      });
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setMode('camera');
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("No se pudo acceder a la cámara. Verifique los permisos.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onPhotoCapture(capturedImage);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setMode('options');
    setCapturedImage(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-blue-900 uppercase tracking-tight">Actualizar Fotografía</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 mt-4">
          {mode === 'options' && !capturedImage && (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={startCamera}
                variant="outline" 
                className="h-32 flex flex-col gap-3 rounded-3xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <Camera className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="font-black uppercase text-[10px] tracking-widest text-gray-600">Tomar Fotografía</span>
              </Button>
              <div className="relative">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <Button 
                  variant="outline" 
                  className="w-full h-32 flex flex-col gap-3 rounded-3xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <Upload className="w-10 h-10 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase text-[10px] tracking-widest text-gray-600">Subir Fotografía</span>
                </Button>
              </div>
            </div>
          )}

          {mode === 'camera' && (
            <div className="flex flex-col gap-4">
              <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-black border-4 border-gray-100 shadow-inner">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 border-[1.5rem] border-white/10 pointer-events-none rounded-[2rem]"></div>
              </div>
              <div className="flex gap-3">
                <Button onClick={capturePhoto} className="flex-1 h-14 bg-blue-900 hover:bg-black text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs">
                  Capturar Foto
                </Button>
                <Button variant="ghost" onClick={() => setMode('options')} className="h-14 font-black uppercase tracking-widest text-[10px] text-gray-400">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="flex flex-col gap-6">
              <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-blue-100 shadow-xl">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleConfirm} className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs flex gap-2">
                  <Check className="w-5 h-5" /> Confirmar Foto
                </Button>
                <Button variant="outline" onClick={() => { setCapturedImage(null); if (mode === 'camera') startCamera(); }} className="h-14 border-gray-200 text-gray-400 font-black rounded-2xl uppercase tracking-widest text-[10px] px-6">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

