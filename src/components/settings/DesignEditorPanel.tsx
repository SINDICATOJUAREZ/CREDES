'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CredentialDesign, DbVisualElement, Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Upload, Trash2, Move, Type, GripVertical, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CredentialCard } from '../credential/CredentialCard';
import { useCredentialConfig } from '@/hooks/useCredentialConfig';
import crypto from 'crypto';
import { Rnd } from 'react-rnd';

const FIELD_CATALOG = [
  { value: 'fullName', label: 'NOMBRE COMPLETO' },
  { value: 'employeeId', label: 'NO. NÓMINA' },
  { value: 'socioId', label: 'NO. SOCIO' },
  { value: 'position', label: 'PUESTO' },
  { value: 'department', label: 'DEPARTAMENTO' },
  { value: 'memberType', label: 'TIPO DE AGREMIADO' },
  { value: 'address', label: 'DOMICILIO' },
  { value: 'colonia', label: 'COLONIA' },
  { value: 'municipio', label: 'MUNICIPIO' },
  { value: 'curp', label: 'CURP' },
  { value: 'phone', label: 'TELÉFONO' },
  { value: 'qr', label: 'CÓDIGO QR' },
  { value: 'foto', label: 'FOTOGRAFÍA' },
  { value: 'fixed_text', label: 'TEXTO FIJO' },
];

const mockMember: Member = {
  id: 'preview', fullName: 'JUAN PEREZ LOPEZ', employeeId: '2196', socioId: '31',
  position: 'INTENDENTE', department: 'PARQUES Y JARDINES', memberType: 'ACTIVO',
  status: 'ACTIVO', family: [], address: 'AV. SIEMPRE VIVA #123', colonia: 'CENTRO',
  municipio: 'MONTERREY, NL', curp: 'PERL900101HNLRPN09', phone: '8112345678',
};

export const CredentialDesignPanel: React.FC = () => {
  const [designs, setDesigns] = useState<CredentialDesign[]>([]);
  const [activeDesign, setActiveDesign] = useState<CredentialDesign | null>(null);
  const [newFieldType, setNewFieldType] = useState('fullName');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const { config, setConfig } = useCredentialConfig();

  const fetchDesigns = async () => {
    const res = await fetch('/api/settings/designs');
    const data = await res.json();
    setDesigns(data);
    const active = data.find((d: CredentialDesign) => d.is_active);
    if (active) setActiveDesign(active);
    else if (data.length > 0) setActiveDesign(data[0]);
  };

  useEffect(() => { fetchDesigns(); }, []);

  // Sync active design to the localStorage config used by CredentialCard
  useEffect(() => {
    if (activeDesign) {
      setConfig({
        id: activeDesign.id,
        name: activeDesign.name,
        primaryColor: activeDesign.primary_color,
        secondaryColor: activeDesign.secondary_color,
        backgroundUrl: activeDesign.background_url,
        showTemplate: activeDesign.show_template !== false,
        elements: activeDesign.elements.map(el => ({
          id: el.id,
          label: el.label || el.campo_bd,
          field: el.campo_bd as any,
          type: el.tipo === 'qr' ? 'qr' : el.tipo === 'imagen' ? 'image' : 'text',
          x: el.x || 0, 
          y: el.y || 0,
          w: el.w || 20,
          h: el.h || 5,
          fontSize: el.font_size || 7,
          fontWeight: (el.font_weight as any) || 'bold',
          color: el.color || '#000000',
          isVisible: !!el.is_visible,
          fixedText: el.fixed_text,
          alignment: el.alignment || 'left',
        })),
      });
    }
  }, [activeDesign]);

  const handleSaveDesign = async () => {
    if (!activeDesign) return;
    const res = await fetch('/api/settings/designs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activeDesign),
    });
    const result = await res.json();
    if (result.error) { toast.error(result.error); return; }
    toast.success('Diseño guardado');
    fetchDesigns();
  };

  const updateElement = (idx: number, updates: Partial<DbVisualElement>) => {
    if (!activeDesign) return;
    const newElements = [...activeDesign.elements];
    newElements[idx] = { ...newElements[idx], ...updates };
    setActiveDesign({ ...activeDesign, elements: newElements });
  };

  const addElement = () => {
    if (!activeDesign) return;
    const field = FIELD_CATALOG.find(f => f.value === newFieldType);
    const newEl: DbVisualElement = {
      id: `ve-${Date.now()}`,
      design_id: activeDesign.id,
      campo_bd: newFieldType,
      label: field?.label || newFieldType,
      tipo: newFieldType === 'qr' ? 'qr' : newFieldType === 'foto' ? 'imagen' : 'texto',
      x: 0, y: 0, w: 20, h: 3,
      color: '#000000', font_size: 8, font_weight: 'bold', alignment: 'left',
      is_visible: true, sort_order: activeDesign.elements.length,
    };
    setActiveDesign({ ...activeDesign, elements: [...activeDesign.elements, newEl] });
  };

  const removeElement = (idx: number) => {
    if (!activeDesign) return;
    const newElements = activeDesign.elements.filter((_, i) => i !== idx);
    setActiveDesign({ ...activeDesign, elements: newElements });
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDesign) return;
    
    const toastId = toast.loading('Subiendo imagen...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload-background', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.url) {
        setActiveDesign({ ...activeDesign, background_url: data.url, show_template: 0 });
        toast.success('Imagen subida correctamente', { id: toastId });
      } else throw new Error(data.error);
    } catch (error) {
      toast.error('Error al subir la imagen', { id: toastId });
    }
  };

  const createNewDesign = async (section: 'frente' | 'reverso') => {
    const newDesign = {
      name: `Nuevo Diseño ${section}`,
      section: section,
      primary_color: '#003366',
      secondary_color: '#EAB308',
      show_template: 1,
      elements: []
    };
    const res = await fetch('/api/settings/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDesign),
    });
    const result = await res.json();
    if (!result.error) {
      toast.success('Diseño creado');
      await fetchDesigns();
      // Switch to the newly created design
      const res2 = await fetch('/api/settings/designs');
      const data = await res2.json();
      const newlyCreated = data.find((d: any) => d.name === newDesign.name && d.section === section);
      if (newlyCreated) setActiveDesign(newlyCreated);
    }
  };

  const deleteDesign = async () => {
    if (!activeDesign || activeDesign.id === 'design-default') {
      toast.error('No se puede eliminar el diseño base');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este diseño?')) return;

    const res = await fetch(`/api/settings/designs?id=${activeDesign.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      toast.success('Diseño eliminado');
      fetchDesigns();
    }
  };

  const switchSection = (section: 'frente' | 'reverso') => {
    // Find designs for this section
    const sectionDesigns = designs.filter(d => d.section === section);
    
    if (sectionDesigns.length > 0) {
      // Try to find the active one, or just the first one
      const target = sectionDesigns.find(d => d.is_active) || sectionDesigns[0];
      setActiveDesign(target);
    } else {
      // Create if none exists
      createNewDesign(section);
    }
  };

  if (!activeDesign) {
    return <div className="flex items-center justify-center h-full text-gray-400 font-bold">Cargando diseños...</div>;
  }

  const MM = 7.56; // 1mm = ~3.78px, scaled by 2 for the editor to look big

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left Controls */}
      <div className="w-[380px] h-full flex flex-col border-r border-gray-100 bg-gray-50/30">
        <div className="p-6 border-b border-gray-100 space-y-4 bg-white flex-shrink-0">
          {/* Design Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Diseño Activo
              </Label>
              <div className="flex gap-1">
                <Button variant={activeDesign.section === 'frente' ? 'default' : 'outline'} size="sm" onClick={() => switchSection('frente')} className="h-6 text-[9px] px-2 uppercase font-black">Frente</Button>
                <Button variant={activeDesign.section === 'reverso' ? 'default' : 'outline'} size="sm" onClick={() => switchSection('reverso')} className="h-6 text-[9px] px-2 uppercase font-black">Reverso</Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={activeDesign.id} onValueChange={v => { const d = designs.find(x => x.id === v); if (d) setActiveDesign(d); }}>
                <SelectTrigger className="h-10 rounded-xl text-sm font-bold flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{designs.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.section})</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={deleteDesign} className="h-10 w-10 text-gray-400 hover:text-red-500 rounded-xl border border-gray-200">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <Label className="text-[10px] font-bold text-gray-500 uppercase">Plantilla Base (Logo/Foto)</Label>
            <Switch checked={activeDesign.show_template !== false} onCheckedChange={v => setActiveDesign({ ...activeDesign, show_template: v })} />
          </div>

          {/* Add Element */}
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Agregar Elemento</Label>
            <div className="flex gap-2">
              <Select value={newFieldType} onValueChange={(val) => setNewFieldType(val as string || '')}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_CATALOG.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addElement} size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700"><Plus className="w-5 h-5" /></Button>
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={handleSaveDesign} className="w-full h-11 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl gap-2 uppercase tracking-widest text-[10px]">
            <Save className="w-4 h-4" /> Guardar Diseño
          </Button>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[9px] font-bold uppercase text-gray-400">Primario</Label>
              <div className="flex gap-1 mt-1">
                <Input type="color" value={activeDesign.primary_color} onChange={e => setActiveDesign({ ...activeDesign, primary_color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" />
                <Input value={activeDesign.primary_color} onChange={e => setActiveDesign({ ...activeDesign, primary_color: e.target.value })} className="h-9 text-[10px] rounded-lg flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[9px] font-bold uppercase text-gray-400">Secundario</Label>
              <div className="flex gap-1 mt-1">
                <Input type="color" value={activeDesign.secondary_color} onChange={e => setActiveDesign({ ...activeDesign, secondary_color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" />
                <Input value={activeDesign.secondary_color} onChange={e => setActiveDesign({ ...activeDesign, secondary_color: e.target.value })} className="h-9 text-[10px] rounded-lg flex-1" />
              </div>
            </div>
          </div>

          {/* Background Image */}
          <div>
            <Label className="text-[9px] font-bold uppercase text-gray-400 mb-1 block">Imagen Fondo (JPG)</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input type="file" accept="image/*" onChange={handleBackgroundUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <Button variant="outline" className="w-full h-9 rounded-xl border-dashed border-2 text-[10px] text-gray-400 gap-1">
                  <Upload className="w-3 h-3" /> Seleccionar archivo
                </Button>
              </div>
              {activeDesign.background_url && (
                <Button variant="ghost" size="icon" onClick={() => setActiveDesign({ ...activeDesign, background_url: undefined })} className="h-9 w-9 text-red-400 hover:text-red-600 rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Elements List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
          {activeDesign.elements.map((el, idx) => (
            <div 
              key={el.id} 
              className={`bg-white rounded-xl border overflow-hidden flex-shrink-0 cursor-pointer transition-colors ${selectedElementId === el.id ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-100 hover:border-blue-200'}`}
              onClick={() => setSelectedElementId(el.id)}
            >
              <div className={`flex items-center justify-between px-3 py-2 ${selectedElementId === el.id ? 'bg-blue-50' : 'border-b border-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className={`text-[10px] font-black uppercase ${selectedElementId === el.id ? 'text-blue-700' : 'text-gray-600'}`}>{el.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={!!el.is_visible} onCheckedChange={v => updateElement(idx, { is_visible: v as any })} />
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeElement(idx); }} className="w-7 h-7 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {el.is_visible && selectedElementId === el.id && (
                <div className="p-3 grid grid-cols-4 gap-2 bg-white">
                  <div><Label className="text-[8px] font-bold text-gray-400">X (mm)</Label>
                    <Input type="number" step="0.1" value={el.x} onChange={e => updateElement(idx, { x: Number(e.target.value) })} className="h-7 text-[10px] rounded-lg" /></div>
                  <div><Label className="text-[8px] font-bold text-gray-400">Y (mm)</Label>
                    <Input type="number" step="0.1" value={el.y} onChange={e => updateElement(idx, { y: Number(e.target.value) })} className="h-7 text-[10px] rounded-lg" /></div>
                  <div><Label className="text-[8px] font-bold text-gray-400">W (mm)</Label>
                    <Input type="number" step="0.1" value={el.w} onChange={e => updateElement(idx, { w: Number(e.target.value) })} className="h-7 text-[10px] rounded-lg" /></div>
                  <div><Label className="text-[8px] font-bold text-gray-400">H (mm)</Label>
                    <Input type="number" step="0.1" value={el.h} onChange={e => updateElement(idx, { h: Number(e.target.value) })} className="h-7 text-[10px] rounded-lg" /></div>
                  <div><Label className="text-[8px] font-bold text-gray-400">Font</Label>
                    <Input type="number" value={el.font_size} onChange={e => updateElement(idx, { font_size: Number(e.target.value) })} className="h-7 text-[10px] rounded-lg" /></div>
                  <div><Label className="text-[8px] font-bold text-gray-400">Color</Label>
                    <Input type="color" value={el.color} onChange={e => updateElement(idx, { color: e.target.value })} className="h-7 p-0.5 rounded-lg w-full" /></div>
                  <div className="col-span-2">
                    <Label className="text-[8px] font-bold text-gray-400">Peso</Label>
                    <Select value={el.font_weight} onValueChange={v => updateElement(idx, { font_weight: (v as string) || 'normal' })}>
                      <SelectTrigger className="h-7 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="normal">Normal</SelectItem>
                         <SelectItem value="bold">Bold</SelectItem>
                         <SelectItem value="black">Black</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Preview */}
      <div className="flex-1 bg-[#e8e8e8] flex items-center justify-center p-8 relative" style={{ backgroundImage: 'linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%), linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}>
        <div className="absolute top-4 right-4 bg-white/80 px-4 py-1 rounded-full z-10 shadow-sm">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Editor Visual (Escala 2x)</span>
        </div>
        
        <div className="relative shadow-2xl rounded-[6mm] overflow-hidden bg-white" style={{
          width: `${86 * MM}px`,
          height: `${54 * MM}px`,
          border: '1px solid #ccc'
        }}>
          {/* Background image */}
          {activeDesign.background_url && (
            <img src={activeDesign.background_url} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" alt="background" />
          )}

          {/* Static Header & Photo Reference */}
          {(activeDesign.show_template !== false) && (
            <>
              <div className="absolute top-0 left-0 right-0 pointer-events-none opacity-30 z-0 flex flex-col" style={{ height: `${13 * MM}px`, backgroundColor: activeDesign.primary_color || '#003366', borderBottom: `${0.5 * MM}px solid #eab308` }}>
                 <span className="m-auto text-white font-bold" style={{ fontSize: `${2.5 * MM}px`}}>ZONA DE ENCABEZADO FIJO</span>
              </div>
              <div className="absolute pointer-events-none opacity-30 z-0 bg-gray-200 flex items-center justify-center" style={{ top: `${16 * MM}px`, left: `${4 * MM}px`, width: `${24 * MM}px`, height: `${28 * MM}px`, border: `${0.8 * MM}px solid ${activeDesign.primary_color || '#003366'}` }}>
                 <span className="text-gray-500 font-bold" style={{ fontSize: `${2.5 * MM}px`}}>FOTO FIJA</span>
              </div>
            </>
          )}

          {/* Interactive Elements */}
          {activeDesign.elements.map((el, idx) => el.is_visible && (
            <Rnd
              key={el.id}
              bounds="parent"
              size={{ width: el.w * MM, height: el.h * MM }}
              position={{ x: el.x * MM, y: el.y * MM }}
              onDragStart={() => setSelectedElementId(el.id)}
              onDragStop={(e, d) => updateElement(idx, { x: Number((d.x / MM).toFixed(1)), y: Number((d.y / MM).toFixed(1)) })}
              onResizeStart={() => setSelectedElementId(el.id)}
              onResizeStop={(e, dir, ref, delta, position) => {
                updateElement(idx, { 
                  w: Number((parseFloat(ref.style.width) / MM).toFixed(1)), 
                  h: Number((parseFloat(ref.style.height) / MM).toFixed(1)),
                  x: Number((position.x / MM).toFixed(1)),
                  y: Number((position.y / MM).toFixed(1))
                });
              }}
              className={`group ${selectedElementId === el.id ? 'ring-1 ring-blue-500 z-50' : 'z-10'}`}
              style={{ position: 'absolute' }}
              onClick={() => setSelectedElementId(el.id)}
            >
              <div className="absolute inset-0 border border-transparent group-hover:border-blue-400 group-hover:bg-blue-400/10 cursor-move transition-colors" />
              <div 
                className="w-full h-full relative z-10 pointer-events-none flex"
                style={{
                  alignItems: el.alignment === 'center' ? 'center' : 'flex-start',
                  justifyContent: el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'flex-end' : 'flex-start',
                  color: el.color,
                  fontSize: `${el.font_size * 2}pt`, // scaled font size
                  fontWeight: el.font_weight,
                  lineHeight: 1.1
                }}
              >
                {el.tipo === 'qr' ? (
                  <div className="w-full h-full bg-black/80 flex items-center justify-center text-white text-[12px] font-mono rounded-md">QR</div>
                ) : el.tipo === 'imagen' ? (
                  <div className="w-full h-full bg-gray-200/80 flex items-center justify-center text-gray-500 rounded-md border-2 border-dashed border-gray-400">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                ) : (
                  <div className="w-full h-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {el.fixed_text || (mockMember[el.campo_bd as keyof Member] as string) || `[${el.label}]`}
                  </div>
                )}
              </div>
            </Rnd>
          ))}
        </div>
        
        <p className="absolute bottom-4 text-[9px] text-gray-500 font-medium italic z-10 bg-white/80 px-2 py-1 rounded shadow-sm">Arrastre o cambie el tamaño de los elementos libremente.</p>
      </div>
    </div>
  );
};
