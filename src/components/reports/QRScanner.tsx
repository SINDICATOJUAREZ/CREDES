'use client';
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface Props {
  onScan: (text: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
        scannerRef.current?.clear().then(() => {
          onClose();
        }).catch(err => console.error("Failed to clear scanner", err));
      },
      (error) => {
        // console.warn(error);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner on unmount", err));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors z-10"
        >
          <span className="text-2xl">×</span>
        </button>
        
        <div className="text-center mb-6">
          <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Escáner QR de Asistencia</h3>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 italic">Apunta la cámara a la credencial del agremiado</p>
        </div>

        <div id="reader" className="overflow-hidden rounded-2xl border-4 border-gray-50 shadow-inner"></div>
        
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="w-12 h-1 bg-gray-100 rounded-full"></div>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">SICSUTSMBJ 2026</p>
        </div>
      </div>
    </div>
  );
}
