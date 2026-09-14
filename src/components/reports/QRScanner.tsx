'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Zap, ZapOff, X, SwitchCamera, Focus, Sparkles } from 'lucide-react';
import jsQR from 'jsqr';

interface Props {
  onScan: (text: string) => void;
  onClose: () => void;
}

interface FocusPoint {
  x: number;
  y: number;
  id: number;
}

export function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const isScanningPausedRef = useRef<boolean>(false);

  // States
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [focusStatus, setFocusStatus] = useState<'idle' | 'focusing' | 'focused'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedSuccess, setScannedSuccess] = useState<boolean>(false);
  const [isEngineNative, setIsEngineNative] = useState<boolean>(false);

  // Play pleasant sound on successful scan
  const playScanBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1480, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio playback silently suppressed if blocked by browser policy
    }
  }, []);

  // Safe haptic feedback
  const triggerHaptic = useCallback((pattern: number | number[] = 35) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignored if not permitted
      }
    }
  }, []);

  // Stop current active media stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignored
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Handle successful decoded text
  const handleSuccess = useCallback((decodedText: string) => {
    if (isScanningPausedRef.current) return;
    isScanningPausedRef.current = true;
    setScannedSuccess(true);
    triggerHaptic([50, 60, 50]);
    playScanBeep();

    setTimeout(() => {
      stopStream();
      onScan(decodedText);
      onClose();
    }, 350);
  }, [onScan, onClose, playScanBeep, triggerHaptic, stopStream]);

  // Load available camera devices
  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      // Sort prioritizing back-facing cameras
      const sorted = [...videoDevices].sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aIsBack = aLabel.includes('back') || aLabel.includes('rear') || aLabel.includes('trasera') || aLabel.includes('environment');
        const bIsBack = bLabel.includes('back') || bLabel.includes('rear') || bLabel.includes('trasera') || bLabel.includes('environment');
        if (aIsBack && !bIsBack) return -1;
        if (!aIsBack && bIsBack) return 1;
        return 0;
      });

      setCameras(sorted);
    } catch (err) {
      console.warn('Could not enumerate cameras:', err);
    }
  }, []);

  // Start camera stream with optimal focus constraints
  const startCamera = useCallback(async (deviceIndex: number) => {
    stopStream();
    setCameraError(null);
    setIsTorchOn(false);

    try {
      const selectedDevice = cameras[deviceIndex];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoConstraints: any = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      };

      if (selectedDevice?.deviceId) {
        videoConstraints.deviceId = { exact: selectedDevice.deviceId };
      } else {
        videoConstraints.facingMode = { ideal: 'environment' };
      }

      // Add continuous autofocus constraint for supported hardware
      videoConstraints.advanced = [{ focusMode: 'continuous' }];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Read capabilities of active video track
      const track = stream.getVideoTracks()[0];
      if (track) {
        // Enforce continuous autofocus if supported
        const getCaps = track.getCapabilities ? track.getCapabilities() : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = getCaps as any;

        if (caps?.focusMode?.includes('continuous')) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (track as any).applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
          } catch (e) {
            console.debug('Failed to apply continuous focus constraint:', e);
          }
        }

        // Check torch
        setHasTorch(Boolean(caps?.torch));

        // Check zoom
        if (caps?.zoom && caps.zoom.max > 1) {
          setZoomRange({
            min: caps.zoom.min || 1,
            max: caps.zoom.max || 3,
            step: caps.zoom.step || 0.1,
          });
          const initialZoom = Math.max(1, caps.zoom.min || 1);
          setCurrentZoom(initialZoom);
        } else {
          setZoomRange(null);
        }
      }
    } catch (err: unknown) {
      console.error('Error opening camera:', err);
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos en tu navegador.');
    }
  }, [cameras, stopStream]);

  // Handle Tap to Focus
  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setFocusPoint({ x, y, id: Date.now() });
    setFocusStatus('focusing');
    triggerHaptic(35);

    // Apply hardware refocusing on track
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = track.getCapabilities ? (track.getCapabilities() as any) : null;
      const normX = Math.max(0, Math.min(1, x / rect.width));
      const normY = Math.max(0, Math.min(1, y / rect.height));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const advancedList: any[] = [];

      if (caps?.pointsOfInterest) {
        advancedList.push({ pointsOfInterest: [{ x: normX, y: normY }] });
      }

      if (caps?.focusMode?.includes('continuous')) {
        advancedList.push({ focusMode: 'continuous' });
      } else if (caps?.focusMode?.includes('single-shot')) {
        advancedList.push({ focusMode: 'single-shot' });
      }

      if (advancedList.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (track as any).applyConstraints({
            advanced: advancedList,
          });
        } catch {
          // Fallback: cycle continuous focus
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (track as any).applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
          } catch {
            // Ignored
          }
        }
      }
    }

    setTimeout(() => {
      setFocusStatus('focused');
    }, 450);

    setTimeout(() => {
      setFocusPoint(null);
      setFocusStatus('idle');
    }, 1800);
  };

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
      triggerHaptic(25);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Apply Zoom
  const applyZoom = async (zoomVal: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (track as any).applyConstraints({
        advanced: [{ zoom: zoomVal }],
      });
      setCurrentZoom(zoomVal);
      triggerHaptic(20);
    } catch (err) {
      console.warn('Apply zoom failed:', err);
    }
  };

  // Switch to next available camera
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const nextIdx = (selectedCameraIndex + 1) % cameras.length;
    setSelectedCameraIndex(nextIdx);
    triggerHaptic(30);
  };

  // Initialize camera list on mount
  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  // Start selected camera
  useEffect(() => {
    startCamera(selectedCameraIndex);
    return () => {
      stopStream();
    };
  }, [selectedCameraIndex, startCamera, stopStream]);

  // High-performance scanning loop: native BarcodeDetector with jsQR fallback
  useEffect(() => {
    isScanningPausedRef.current = false;

    // Check native BarcodeDetector support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        setIsEngineNative(true);
      } catch (err) {
        console.warn('BarcodeDetector unavailable, using jsQR fallback:', err);
        nativeDetector = null;
        setIsEngineNative(false);
      }
    } else {
      setIsEngineNative(false);
    }

    let isProcessing = false;
    let lastScanTime = 0;

    const scanFrame = async (timestamp: number) => {
      if (isScanningPausedRef.current) return;

      const video = videoRef.current;
      // Throttle scanning to every 65ms (~15-16 scans/second) for fast detection with low CPU/battery consumption
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && timestamp - lastScanTime >= 65) {
        lastScanTime = timestamp;

        if (!isProcessing) {
          isProcessing = true;

          try {
            if (nativeDetector) {
              // Direct GPU native detection from video element without canvas overhead
              const barcodes = await nativeDetector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleSuccess(barcodes[0].rawValue);
                return;
              }
            } else {
              // Fast fallback using offscreen canvas & jsQR
              if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
              }
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });

              if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                // Downscale to max 480px width for near-instant jsQR execution (10-15ms)
                const scale = Math.min(1, 480 / video.videoWidth);
                const w = Math.max(1, Math.floor(video.videoWidth * scale));
                const h = Math.max(1, Math.floor(video.videoHeight * scale));

                if (canvas.width !== w || canvas.height !== h) {
                  canvas.width = w;
                  canvas.height = h;
                }

                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });

                if (code && code.data) {
                  handleSuccess(code.data);
                  return;
                }
              }
            }
          } catch {
            // Frame detection error, continue loop
          } finally {
            isProcessing = false;
          }
        }
      }

      if (!isScanningPausedRef.current) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      isScanningPausedRef.current = true;
    };
  }, [handleSuccess]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-950 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col items-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between px-5 pt-4 pb-3 bg-gradient-to-b from-neutral-900 to-neutral-950 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Escáner QR</h3>
              <p className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
                {isEngineNative ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Detección Ultrarrápida por GPU
                  </span>
                ) : (
                  'Autoenfoque continuo'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Cerrar escáner"
            className="w-9 h-9 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport & Focus Area */}
        <div
          ref={containerRef}
          onClick={handleTapToFocus}
          className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center cursor-pointer group"
        >
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover pointer-events-none"
          />

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white mb-2">Permiso de Cámara Requerido</p>
              <p className="text-xs text-neutral-400 leading-relaxed mb-4">{cameraError}</p>
              <button
                onClick={() => startCamera(selectedCameraIndex)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors"
              >
                Reintentar Conexión
              </button>
            </div>
          )}

          {/* QR Viewfinder Target Frame */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Viewfinder Target Box */}
            <div
              className={`relative w-64 h-64 rounded-3xl transition-all duration-300 ${
                scannedSuccess
                  ? 'border-4 border-emerald-400 scale-105 shadow-[0_0_35px_rgba(52,211,153,0.8)]'
                  : 'border-2 border-white/20'
              }`}
            >
              {/* Corner HUD Brackets */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl shadow-[0_0_10px_rgba(59,130,246,0.6)]" />

              {/* Animated Laser Scanning Line */}
              {!scannedSuccess && (
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser" />
              )}
            </div>
          </div>

          {/* Tap-To-Focus HUD Reticle */}
          {focusPoint && (
            <div
              key={focusPoint.id}
              style={{ left: `${focusPoint.x}px`, top: `${focusPoint.y}px` }}
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
            >
              {/* Pulse Ring */}
              <div className="w-16 h-16 border-2 border-amber-400/80 rounded-xl animate-ping opacity-60" />
              {/* Target Square */}
              <div
                className={`absolute w-14 h-14 border-2 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  focusStatus === 'focused'
                    ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.7)]'
                    : 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.7)]'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    focusStatus === 'focused' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Floating Action Controls (Torch & Camera Flip) */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            {/* Flashlight / Torch Button */}
            {hasTorch && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTorch();
                }}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-lg ${
                  isTorchOn
                    ? 'bg-amber-400 text-neutral-950 ring-4 ring-amber-400/30'
                    : 'bg-black/60 text-white/90 hover:bg-black/80'
                }`}
                title="Encender Linterna"
              >
                {isTorchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
              </button>
            )}

            {/* Switch Camera Button */}
            {cameras.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  switchCamera();
                }}
                className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/90 flex items-center justify-center transition-all shadow-lg active:scale-95"
                title="Cambiar Cámara"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Floating Zoom Controls (1x, 1.5x, 2x) */}
          {zoomRange && zoomRange.max > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 flex items-center gap-1 z-20 shadow-xl"
            >
              <button
                onClick={() => applyZoom(1)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                  Math.abs(currentZoom - 1) < 0.2
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                1x
              </button>
              {zoomRange.max >= 1.5 && (
                <button
                  onClick={() => applyZoom(1.5)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                    Math.abs(currentZoom - 1.5) < 0.2
                      ? 'bg-white text-black shadow'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  1.5x
                </button>
              )}
              {zoomRange.max >= 2 && (
                <button
                  onClick={() => applyZoom(2)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                    Math.abs(currentZoom - 2) < 0.2
                      ? 'bg-white text-black shadow'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  2x
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Helper Bar & Tips */}
        <div className="w-full px-6 py-4 bg-neutral-900 border-t border-neutral-800 flex flex-col items-center gap-2 text-center z-10">
          <div className="flex items-center gap-2 text-neutral-300 text-xs font-semibold">
            <Focus className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Toca la pantalla para enfocar</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">Mantén a 15-20 cm</span>
          </div>

          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
            SICSUTSMBJ 2026
          </p>
        </div>
      </div>
    </div>
  );
}
