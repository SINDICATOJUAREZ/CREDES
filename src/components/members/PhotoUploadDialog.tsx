'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RefreshCw, Check, X, RotateCw, ZoomIn, ZoomOut, Maximize2, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCapture: (photoUrl: string) => void;
  currentPhoto?: string;
  employeeId?: string;
}

// Credential photo aspect ratio is 24mm wide x 28mm high (6:7 ratio)
const CROP_W = 264;
const CROP_H = 308; // 264 / 308 = 0.85714 = 24 / 28

export const PhotoUploadDialog: React.FC<PhotoUploadDialogProps> = ({ 
  isOpen, 
  onClose, 
  onPhotoCapture,
  currentPhoto,
  employeeId
}) => {
  const [mode, setMode] = useState<'options' | 'camera' | 'crop'>('options');
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Camera states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const savedDeviceId = localStorage.getItem('preferredCameraId');
      if (savedDeviceId) setSelectedDeviceId(savedDeviceId);
      
      navigator.mediaDevices?.enumerateDevices?.().then(devs => {
        const videoDevices = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      }).catch(() => {});
    }
  }, [isOpen]);

  const startCamera = async (deviceIdToUse?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const devId = deviceIdToUse || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: devId 
          ? { deviceId: { exact: devId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setMode('camera');
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the webcam capture to match the mirrored preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        stopCamera();
        loadImageForCropping(dataUrl);
      }
    }
  };

  const loadImageForCropping = (dataUrl: string) => {
    setRawImage(dataUrl);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setMode('crop');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        loadImageForCropping(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    // Reset so same file can be chosen again if desired
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        loadImageForCropping(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setPan({
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y
        });
      }
    };

    const onEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom(prev => Math.min(Math.max(1, +(prev + delta).toFixed(2)), 3.5));
  };

  const rotateClockwise = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const resetCrop = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Dimensions & Scale calculation
  const isRotatedVertical = rotation % 180 !== 0;
  const effectiveW = isRotatedVertical ? imageDimensions.height : imageDimensions.width;
  const effectiveH = isRotatedVertical ? imageDimensions.width : imageDimensions.height;
  const baseScale = effectiveW > 0 && effectiveH > 0
    ? Math.max(CROP_W / effectiveW, CROP_H / effectiveH)
    : 1;
  const totalScale = baseScale * zoom;

  const handleConfirmCrop = async () => {
    if (!imageRef.current || !rawImage) return;
    setIsProcessing(true);

    try {
      const img = imageRef.current;
      const TARGET_W = 600;
      const TARGET_H = 700; // 600 x 700 px high res = 24mm x 28mm credential frame ratio
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_W;
      canvas.height = TARGET_H;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        toast.error('No se pudo inicializar el procesador de imagen.');
        setIsProcessing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill white background in case of transparent PNG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);

      const ratio = TARGET_W / CROP_W;

      ctx.translate(TARGET_W / 2 + pan.x * ratio, TARGET_H / 2 + pan.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(totalScale * ratio, totalScale * ratio);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      onPhotoCapture(croppedDataUrl);
      toast.success('Fotografía recortada y ajustada al marco de la credencial.');
      handleClose();
    } catch (err) {
      console.error('Error recortando imagen:', err);
      toast.error('Hubo un error al recortar la fotografía.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setMode('options');
    setRawImage(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-xl rounded-[2.5rem] p-8 border-none shadow-2xl bg-white max-h-[95vh] overflow-y-auto"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black text-blue-900 uppercase tracking-tight">
                {mode === 'crop' ? 'Ajustar y Recortar Fotografía' : 'Actualizar Fotografía'}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                {mode === 'crop' 
                  ? 'Marco de credencial oficial SUTSMBJ (24 × 28 mm)' 
                  : 'Selecciona una foto para la credencial sindical'}
              </DialogDescription>
            </div>
            {mode === 'crop' && (
              <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                24 × 28 mm
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Hidden File Input */}
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          className="hidden"
          onChange={handleFileUpload}
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-col gap-6 mt-2">
          {/* MODE 1: OPTIONS */}
          {mode === 'options' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  type="button"
                  onClick={() => startCamera()}
                  variant="outline" 
                  className="h-36 flex flex-col gap-3 rounded-3xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <Camera className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-center">
                    <span className="font-black uppercase text-xs tracking-wider text-gray-800 block">Tomar Fotografía</span>
                    <span className="text-[10px] text-gray-400 font-bold mt-0.5 block">Usar cámara web o móvil</span>
                  </div>
                </Button>

                <Button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline" 
                  className="h-36 flex flex-col gap-3 rounded-3xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                    <Upload className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-center">
                    <span className="font-black uppercase text-xs tracking-wider text-gray-800 block">Subir Fotografía</span>
                    <span className="text-[10px] text-gray-400 font-bold mt-0.5 block">Desde archivo local o arrastrar</span>
                  </div>
                </Button>
              </div>

              {currentPhoto && (
                <div className="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white">
                      <img src={currentPhoto} alt="Actual" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-800 block uppercase">Fotografía Actual</span>
                      <span className="text-[10px] text-gray-400 font-medium">Puedes reencuadrarla con el nuevo marco</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadImageForCropping(currentPhoto)}
                    className="rounded-xl border-gray-200 text-blue-900 font-black text-[10px] uppercase tracking-wider h-9"
                  >
                    Reencuadrar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: CAMERA */}
          {mode === 'camera' && (
            <div className="flex flex-col gap-4">
              {devices.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Cámara:</span>
                  <select 
                    value={selectedDeviceId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDeviceId(id);
                      localStorage.setItem('preferredCameraId', id);
                      startCamera(id);
                    }}
                    className="flex-1 h-9 px-3 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  >
                    {devices.map((d, idx) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Cámara ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-black border-4 border-gray-100 shadow-inner flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Visual Credential Frame overlay on video */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
                  <div 
                    style={{ width: `${CROP_W * 0.85}px`, height: `${CROP_H * 0.85}px` }}
                    className="border-2 border-dashed border-yellow-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative flex items-center justify-center"
                  >
                    <span className="absolute -top-6 text-[9px] font-black text-yellow-300 uppercase tracking-widest bg-black/60 px-2 py-0.5 rounded">
                      Enfoque Credencial
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button"
                  onClick={capturePhoto} 
                  className="flex-1 h-14 bg-blue-900 hover:bg-black text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  Capturar y Recortar
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => { stopCamera(); setMode('options'); }} 
                  className="h-14 font-black uppercase tracking-widest text-[10px] text-gray-500 rounded-2xl cursor-pointer"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* MODE 3: CROP & ADJUST */}
          {mode === 'crop' && rawImage && (
            <div className="flex flex-col items-center gap-5">
              {/* Offscreen image to get natural dimensions */}
              <img 
                ref={imageRef}
                src={rawImage} 
                alt="Source" 
                onLoad={handleImageLoad}
                className="hidden"
              />

              {/* Crop Viewport */}
              <div className="relative p-6 bg-slate-900 rounded-[2rem] w-full flex flex-col items-center justify-center shadow-xl select-none">
                <div 
                  style={{ width: `${CROP_W}px`, height: `${CROP_H}px` }}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onWheel={handleWheel}
                  className={`relative overflow-hidden rounded-xl bg-slate-950 border-2 border-blue-500 shadow-2xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  {/* The interactive transformed image */}
                  <img 
                    src={rawImage}
                    alt="Preview"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${totalScale}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Rule of thirds grid lines */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div></div>
                  </div>

                  {/* Face positioning guide (silhouette / oval) */}
                  {showFaceGuide && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-start pt-6">
                      <div className="w-28 h-36 rounded-[50%] border-2 border-dashed border-amber-300/60 flex items-center justify-center">
                        <div className="w-16 h-0.5 bg-amber-300/40"></div>
                      </div>
                      <div className="w-48 h-14 rounded-t-[50%] border-t-2 border-dashed border-amber-300/50 mt-1"></div>
                    </div>
                  )}

                  {/* Corner indicator brackets */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-400 pointer-events-none"></div>
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-400 pointer-events-none"></div>
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-400 pointer-events-none"></div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-400 pointer-events-none"></div>

                  {/* Frame tag */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-black text-white/90 uppercase tracking-widest pointer-events-none">
                    Credencial 24 × 28 mm
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-3 flex items-center gap-2">
                  <span>Arrastra para mover</span>
                  <span>•</span>
                  <span>Rueda para zoom</span>
                </div>
              </div>

              {/* Controls bar: Zoom, Rotate, Reset */}
              <div className="w-full flex flex-col gap-3 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setZoom(prev => Math.max(1, +(prev - 0.1).toFixed(2)))}
                    className="h-8 w-8 text-gray-600 hover:text-blue-900"
                    title="Reducir zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  
                  <input 
                    type="range"
                    min="1"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                  />

                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setZoom(prev => Math.min(3.5, +(prev + 0.1).toFixed(2)))}
                    className="h-8 w-8 text-gray-600 hover:text-blue-900"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>

                  <span className="text-xs font-black text-gray-700 w-12 text-right">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200/60">
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={rotateClockwise}
                      className="h-8 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 hover:bg-gray-100"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotar 90°
                    </Button>
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={resetCrop}
                      className="h-8 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 hover:bg-gray-100"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Centrar
                    </Button>
                  </div>

                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => setShowFaceGuide(!showFaceGuide)}
                    className={`h-8 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${showFaceGuide ? 'text-amber-700 bg-amber-50' : 'text-gray-400'}`}
                  >
                    Guía de Rostro: {showFaceGuide ? 'ON' : 'OFF'}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                <Button 
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmCrop} 
                  className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Check className="w-5 h-5" /> 
                  {isProcessing ? 'Procesando Recorte...' : 'Confirmar y Recortar'}
                </Button>

                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => { setRawImage(null); setMode('options'); }} 
                  className="h-14 border-gray-200 text-gray-600 font-black rounded-2xl uppercase tracking-widest text-[10px] px-4 flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cambiar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
