'use client';
// Force rebuild 2026-05-10
import React from 'react';
import { CredentialConfig, VisualElement, Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Move, Type, Palette, Settings2, Image as ImageIcon, Upload } from 'lucide-react';

interface DesignPanelProps {
  config: CredentialConfig;
  onUpdate: (config: CredentialConfig) => void;
}

export const DesignPanel: React.FC<DesignPanelProps> = ({ config, onUpdate }) => {
  const updateElement = (id: string, updates: Partial<VisualElement>) => {
    const newElements = config.elements.map(el => el.id === id ? { ...el, ...updates } : el);
    onUpdate({ ...config, elements: newElements });
  };
  
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({ ...config, backgroundUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-gray-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" /> Colores Institucionales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold">Primario</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={config.primaryColor} 
                  onChange={(e) => onUpdate({ ...config, primaryColor: e.target.value })}
                  className="w-10 h-10 p-1"
                />
                <Input value={config.primaryColor} onChange={(e) => onUpdate({ ...config, primaryColor: e.target.value })} className="h-10 text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold">Secundario</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={config.secondaryColor} 
                  onChange={(e) => onUpdate({ ...config, secondaryColor: e.target.value })}
                  className="w-10 h-10 p-1"
                />
                <Input value={config.secondaryColor} onChange={(e) => onUpdate({ ...config, secondaryColor: e.target.value })} className="h-10 text-xs" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 block">Imagen de Fondo (Plantilla)</Label>
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBackgroundUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-2 border-gray-200 flex gap-2 items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-600 transition-all">
                  <Upload className="w-4 h-4" /> Seleccionar Archivo
                </Button>
              </div>
              {config.backgroundUrl && (
                <Button 
                  variant="ghost" 
                  onClick={() => onUpdate({ ...config, backgroundUrl: undefined })}
                  className="h-12 text-red-500 font-bold text-[10px] uppercase tracking-widest"
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 px-2">
          <Settings2 className="w-3 h-3" /> Elementos de la Credencial
        </h4>
        
        <div className="space-y-3">
          {config.elements.map((el) => (
            <Card key={el.id} className="border border-gray-100 overflow-hidden">
              <div className="bg-white p-3 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold">{el.label}</span>
                </div>
                <Switch 
                  checked={el.isVisible} 
                  onCheckedChange={(val) => updateElement(el.id, { isVisible: val })} 
                />
              </div>
              
              {el.isVisible && (
                <div className="p-3 bg-gray-50/30 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
                      <Move className="w-2 h-2" /> Posición X (mm)
                    </Label>
                    <Input 
                      type="number" 
                      value={el.x} 
                      onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-gray-400 flex items-center gap-1">
                      <Move className="w-2 h-2" /> Posición Y (mm)
                    </Label>
                    <Input 
                      type="number" 
                      value={el.y} 
                      onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-gray-400">Tamaño Fuente</Label>
                    <Input 
                      type="number" 
                      value={el.fontSize} 
                      onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-gray-400">Color</Label>
                    <Input 
                      type="color" 
                      value={el.color} 
                      onChange={(e) => updateElement(el.id, { color: e.target.value })}
                      className="h-8 p-1 w-full"
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
