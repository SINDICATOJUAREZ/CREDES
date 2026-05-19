'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Camera, Check, Layout, Shield, Users, Key, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { UsersPanel, RolesPanel } from '../settings/SecurityPanels';
import { CredentialDesignPanel } from '../settings/DesignEditorPanel';
import { PhotosPanel } from '../settings/PhotosPanel';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'camera' | 'design' | 'users' | 'roles' | 'photos';

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'design', label: 'Diseño Credencial', icon: Layout, description: 'Editor visual de plantillas' },
  { id: 'camera', label: 'Cámara y Captura', icon: Camera, description: 'Dispositivos de entrada' },
  { id: 'photos', label: 'Galería de Fotos', icon: ImageIcon, description: 'Ver y gestionar fotografías' },
  { id: 'users', label: 'Usuarios', icon: Users, description: 'Gestión de cuentas' },
  { id: 'roles', label: 'Roles y Permisos', icon: Key, description: 'Control de acceso RBAC' },
];

export const SystemSettingsDialog: React.FC<SystemSettingsDialogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('design');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const savedCamera = localStorage.getItem('preferredCameraId');
      if (savedCamera) setSelectedCameraId(savedCamera);
      navigator.mediaDevices?.enumerateDevices().then(ds => {
        setDevices(ds.filter(d => d.kind === 'videoinput'));
      }).catch(() => {});
    }
  }, [isOpen]);

  const saveCamera = (id: string) => {
    setSelectedCameraId(id);
    localStorage.setItem('preferredCameraId', id);
    toast.success('Cámara configurada');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-[1400px] h-[90vh] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white flex flex-col">
        <div className="flex h-full w-full min-h-0">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-gradient-to-b from-[#0a1628] to-[#1a2a4a] text-white flex flex-col">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white/80" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-tight leading-none">Panel de</h2>
                  <h2 className="text-base font-black uppercase tracking-tight leading-none text-blue-300">Control</h2>
                </div>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 p-4 space-y-1.5">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 group ${
                    activeTab === item.id
                      ? 'bg-white/15 text-white shadow-lg shadow-black/20'
                      : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-blue-300' : ''}`} />
                  <div>
                    <span className="text-sm font-bold block leading-tight">{item.label}</span>
                    <span className="text-[9px] font-medium opacity-60">{item.description}</span>
                  </div>
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <Button onClick={onClose} variant="ghost" className="w-full h-10 text-white/40 hover:text-white hover:bg-white/10 font-bold rounded-xl text-[10px] uppercase tracking-widest">
                Cerrar Panel
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-gray-50 flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab === 'camera' && (
                <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 h-full p-10 overflow-y-auto">
                  <CameraPanel devices={devices} selectedCameraId={selectedCameraId} onSelect={saveCamera} />
                </motion.div>
              )}
              {activeTab === 'design' && (
                <motion.div key="design" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 h-full flex flex-col">
                  <CredentialDesignPanel />
                </motion.div>
              )}
              {activeTab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 h-full p-10 overflow-y-auto">
                  <UsersPanel />
                </motion.div>
              )}
              {activeTab === 'roles' && (
                <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 h-full p-10 overflow-y-auto">
                  <RolesPanel />
                </motion.div>
              )}
              {activeTab === 'photos' && (
                <motion.div key="photos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 h-full p-10 overflow-y-auto">
                  <PhotosPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// =============================================
// Camera Panel (inline, self-contained)
// =============================================
const CameraPanel: React.FC<{ devices: MediaDeviceInfo[]; selectedCameraId: string; onSelect: (id: string) => void }> = ({ devices, selectedCameraId, onSelect }) => (
  <div className="max-w-2xl">
    <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Configuración de Dispositivos</h3>
    <p className="text-sm text-gray-400 font-medium mt-1 mb-8">Seleccione el dispositivo de captura predeterminado para las fotografías.</p>
    {devices.length === 0 ? (
      <div className="p-12 bg-white rounded-2xl border border-gray-100 text-center">
        <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-400 font-bold">No se detectaron dispositivos de cámara</p>
        <p className="text-xs text-gray-300 mt-1">Conecte una cámara y recargue la página</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3">
        {devices.map((device, i) => (
          <button
            key={device.deviceId}
            onClick={() => onSelect(device.deviceId)}
            className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
              selectedCameraId === device.deviceId
                ? 'border-blue-600 bg-white text-blue-900 shadow-lg shadow-blue-100'
                : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedCameraId === device.deviceId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase tracking-tight">{device.label || `Cámara ${i + 1}`}</p>
                <p className="text-[10px] opacity-50 font-mono">{device.deviceId.substring(0, 24)}...</p>
              </div>
            </div>
            {selectedCameraId === device.deviceId && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Check className="w-5 h-5" />
              </div>
            )}
          </button>
        ))}
      </div>
    )}
  </div>
);
