'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CredentialDesign, DbVisualElement, Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Upload, Trash2, Move, Type, GripVertical, Image as ImageIcon, Download, Undo, Redo, AlignCenter, MoveVertical } from 'lucide-react';

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
  { value: 'department', label: 'DIRECCIÓN' },
  { value: 'secretariat', label: 'SECRETARÍA' },
  { value: 'memberType', label: 'TIPO DE AGREMIADO' },
  { value: 'address', label: 'DOMICILIO' },
  { value: 'colonia', label: 'COLONIA' },
  { value: 'municipio', label: 'MUNICIPIO' },
  { value: 'curp', label: 'CURP' },
  { value: 'phone', label: 'TELÉFONO' },
  { value: 'qr', label: 'CÓDIGO QR' },
  { value: 'foto', label: 'FOTOGRAFÍA' },
  { value: 'fixed_text', label: 'TEXTO FIJO' },
  { value: 'emision', label: 'FECHA DE EMISIÓN (AUTO)' },
  { value: 'vigencia', label: 'FECHA DE VIGENCIA (AUTO)' },
];


const mockMember: Member = {
  id: 'preview', fullName: 'JUAN PEREZ LOPEZ', employeeId: '2196', socioId: '31',
  position: 'INTENDENTE', department: 'PARQUES Y JARDINES', secretariat: 'SECRETARÍA DE SERVICIOS PÚBLICOS', memberType: 'AGREMIADO',
  status: 'ACTIVO', family: [], address: 'AV. SIEMPRE VIVA #123', colonia: 'CENTRO',
  municipio: 'MONTERREY, NL', curp: 'PERL900101HNLRPN09', phone: '8112345678',
  photoUrl: '/logos/logo2.png'
};

const MM = 7.56; // 1mm = ~3.78px, scaled by 2 for the editor to look big

export const CredentialDesignPanel: React.FC = () => {
  const [designs, setDesigns] = useState<CredentialDesign[]>([]);
  const [activeDesign, setActiveDesign] = useState<CredentialDesign | null>(null);
  const [newFieldType, setNewFieldType] = useState('fullName');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isDraggingOrResizing, setIsDraggingOrResizing] = useState(false);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const { config, setConfig } = useCredentialConfig();
  const stateRef = React.useRef({ activeDesign, selectedElementId, selectedElementIds });

  // History state for undo/redo
  const [history, setHistory] = useState<{
    past: CredentialDesign[];
    future: CredentialDesign[];
  }>({ past: [], future: [] });

  const keyboardDragStartDesign = React.useRef<CredentialDesign | null>(null);

  const updateActiveDesignWithHistory = useCallback((newDesign: CredentialDesign) => {
    const currentDesign = stateRef.current.activeDesign;
    if (!currentDesign) {
      setActiveDesign(newDesign);
      return;
    }
    
    // Only push to past history if there are real changes and it's the same design ID
    if (newDesign.id === currentDesign.id) {
      const prevStr = JSON.stringify(currentDesign);
      const nextStr = JSON.stringify(newDesign);
      if (prevStr !== nextStr) {
        setHistory(prev => ({
          past: [...prev.past.slice(-49), currentDesign], // cap at 50
          future: []
        }));
      }
    } else {
      // Design ID changed (switched designs), clear history
      setHistory({ past: [], future: [] });
    }
    setActiveDesign(newDesign);
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      
      const current = stateRef.current.activeDesign;
      if (current) {
        const newFuture = [current, ...prev.future.slice(0, 49)];
        setActiveDesign(previous);
        return {
          past: newPast,
          future: newFuture
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      
      const current = stateRef.current.activeDesign;
      if (current) {
        const newPast = [...prev.past.slice(-49), current];
        setActiveDesign(next);
        return {
          past: newPast,
          future: newFuture
        };
      }
      return prev;
    });
  }, []);

  // Sync stateRef on every render to ensure event listeners and callbacks always have the freshest state without closures
  stateRef.current = { activeDesign, selectedElementId, selectedElementIds };
  const dragStartPositions = React.useRef<{ [key: string]: { x: number; y: number } }>({});
  const dragStartDOMPositions = React.useRef<{ el: HTMLElement; startX: number; startY: number }[]>([]);


  const fetchDesigns = async () => {
    const res = await fetch('/api/settings/designs');
    const data = await res.json();
    setDesigns(data);
    const active = data.find((d: CredentialDesign) => d.is_active);
    if (active) {
      setActiveDesign(active);
      setHistory({ past: [], future: [] });
    } else if (data.length > 0) {
      setActiveDesign(data[0]);
      setHistory({ past: [], future: [] });
    }
  };

  useEffect(() => { fetchDesigns(); }, []);

  // Delay rendering of Rnd components until animations finish (prevent layout offsets)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // Sync active design to the localStorage config used by CredentialCard
  useEffect(() => {
    if (activeDesign) {
      setConfig({
        id: activeDesign.id,
        name: activeDesign.name,
        primaryColor: activeDesign.primary_color,
        secondaryColor: activeDesign.secondary_color,
        backgroundUrl: activeDesign.background_url,
        showTemplate: (activeDesign.show_template as any) !== false && (activeDesign.show_template as any) !== 0,
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
    updateActiveDesignWithHistory({ ...activeDesign, elements: newElements });
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
    updateActiveDesignWithHistory({ ...activeDesign, elements: [...activeDesign.elements, newEl] });
  };

  const removeElement = (idx: number) => {
    if (!activeDesign) return;
    const newElements = activeDesign.elements.filter((_, i) => i !== idx);
    updateActiveDesignWithHistory({ ...activeDesign, elements: newElements });
  };

  const handleSelectElement = useCallback((id: string, isMultiSelect: boolean) => {
    // Blur active input to enable keyboard precision positioning immediately
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
      (activeEl as HTMLElement).blur();
    }

    setSelectedElementIds(prev => {
      let next;
      if (isMultiSelect) {
        next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      } else {
        next = [id];
      }
      setSelectedElementId(next.length > 0 ? next[next.length - 1] : null);
      return next;
    });
  }, []);

  // Keyboard Arrow Keys Precision Positioning for all selected elements
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { activeDesign: currentDesign, selectedElementId: currentId, selectedElementIds: currentIds } = stateRef.current;
    if (!currentDesign) return;

    // Use currentIds if populated, else fallback to currentId
    const idsToMove = currentIds.length > 0 ? currentIds : (currentId ? [currentId] : []);
    if (idsToMove.length === 0) return;
    
    // Bypass if user is actively focused on an input, select or textarea field
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }

    // Capture the initial design state before keyboard movement started, to push into undo history on keyUp
    if (!keyboardDragStartDesign.current) {
      keyboardDragStartDesign.current = currentDesign;
    }

    const step = e.shiftKey ? 1.0 : 0.1; // 1mm with Shift, 0.1mm default
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowUp') {
      dy = -step;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      dy = step;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      dx = -step;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      dx = step;
      e.preventDefault();
    }

    // Show guides during keyboard positioning movement
    setIsDraggingOrResizing(true);

    const newElements = currentDesign.elements.map(el => {
      if (idsToMove.includes(el.id)) {
        let newX = Number((el.x + dx).toFixed(1));
        let newY = Number((el.y + dy).toFixed(1));
        // Boundary constraints: PVC Card size is 86mm x 54mm
        newX = Math.max(0, Math.min(86 - (el.w || 20), newX));
        newY = Math.max(0, Math.min(54 - (el.h || 3), newY));
        return { ...el, x: newX, y: newY };
      }
      return el;
    });

    setActiveDesign({ ...currentDesign, elements: newElements });
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setIsDraggingOrResizing(false);
      const current = stateRef.current.activeDesign;
      if (keyboardDragStartDesign.current && current) {
        const prevStr = JSON.stringify(keyboardDragStartDesign.current);
        const nextStr = JSON.stringify(current);
        if (prevStr !== nextStr) {
          setHistory(prev => ({
            past: [...prev.past.slice(-49), keyboardDragStartDesign.current!],
            future: []
          }));
        }
      }
      keyboardDragStartDesign.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Shortcut listener for Ctrl + Z / Ctrl + Y / Ctrl + Shift + Z
  useEffect(() => {
    const handleUndoRedoShortcuts = (e: KeyboardEvent) => {
      // Bypass if user is actively focused on an input, select or textarea field
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleUndoRedoShortcuts);
    return () => {
      window.removeEventListener('keydown', handleUndoRedoShortcuts);
    };
  }, [undo, redo]);

  // Alignment Guides (Smart Guides) calculation
  const getActiveGuides = () => {
    if (!activeDesign || !selectedElementId) return { x: [], y: [] };
    const selEl = activeDesign.elements.find(el => el.id === selectedElementId);
    if (!selEl || !selEl.is_visible) return { x: [], y: [] };

    const tolerance = 0.5; // snaps or draws guide when within 0.5mm
    const activeGuidesX: number[] = [];
    const activeGuidesY: number[] = [];

    // Filter out all currently selected elements so we don't snap to themselves during multi-drag
    const otherElements = activeDesign.elements.filter(
      el => !selectedElementIds.includes(el.id) && el.is_visible
    );

    // Selected element's key X positions (left edge, center, right edge)
    const selXPoints = [selEl.x, selEl.x + (selEl.w || 20) / 2, selEl.x + (selEl.w || 20)];
    
    // Snapping target points for X
    const targetXPoints = [0, 43, 86]; // Card Left, Horizontal Center (43mm), Card Right
    otherElements.forEach(other => {
      targetXPoints.push(other.x, other.x + (other.w || 20) / 2, other.x + (other.w || 20));
    });

    selXPoints.forEach(sp => {
      targetXPoints.forEach(tp => {
        if (Math.abs(sp - tp) <= tolerance) {
          if (!activeGuidesX.includes(tp)) activeGuidesX.push(tp);
        }
      });
    });

    // Selected element's key Y positions (top edge, center, bottom edge)
    const selYPoints = [selEl.y, selEl.y + (selEl.h || 3) / 2, selEl.y + (selEl.h || 3)];
    
    // Snapping target points for Y
    const targetYPoints = [0, 27, 54]; // Card Top, Vertical Center (27mm), Card Bottom
    otherElements.forEach(other => {
      targetYPoints.push(other.y, other.y + (other.h || 3) / 2, other.y + (other.h || 3));
    });

    selYPoints.forEach(sp => {
      targetYPoints.forEach(tp => {
        if (Math.abs(sp - tp) <= tolerance) {
          if (!activeGuidesY.includes(tp)) activeGuidesY.push(tp);
        }
      });
    });

    return { x: activeGuidesX, y: activeGuidesY };
  };

  const { x: guidesX, y: guidesY } = getActiveGuides();

  const handleDragStart = useCallback((id: string) => {
    setIsDraggingOrResizing(true);
    setIsMouseDragging(true);
    
    const { activeDesign: currentDesign, selectedElementIds: currentIds } = stateRef.current;
    if (!currentDesign) return;

    let nextIds = currentIds;
    if (!currentIds.includes(id)) {
      nextIds = [id];
      setSelectedElementIds([id]);
      setSelectedElementId(id);
    }

    // Cache the DOM elements and initial translations of other selected elements to update directly
    const domElements: { el: HTMLElement; startX: number; startY: number }[] = [];
    nextIds.forEach(selectedId => {
      if (selectedId === id) return; // Dragged element is moved natively by react-rnd
      const domEl = document.getElementById(`rnd-${selectedId}`);
      if (domEl) {
        const style = window.getComputedStyle(domEl);
        const matrix = new DOMMatrixReadOnly(style.transform);
        domElements.push({
          el: domEl,
          startX: matrix.m41 || parseFloat(domEl.style.left) || 0,
          startY: matrix.m42 || parseFloat(domEl.style.top) || 0,
        });
      }
    });
    dragStartDOMPositions.current = domElements;

    const startPositions: { [key: string]: { x: number; y: number } } = {};
    currentDesign.elements.forEach(el => {
      if (nextIds.includes(el.id)) {
        startPositions[el.id] = { x: el.x, y: el.y };
      }
    });
    dragStartPositions.current = startPositions;
  }, []);

  const handleDrag = useCallback((id: string, d: any) => {
    const startPos = dragStartPositions.current[id];
    if (!startPos) return;

    // Calculate relative pixel displacement
    const dx_px = d.x - (startPos.x * MM);
    const dy_px = d.y - (startPos.y * MM);

    // Directly transform secondary DOM elements without triggering React renders
    dragStartDOMPositions.current.forEach(item => {
      const newTranslateX = item.startX + dx_px;
      const newTranslateY = item.startY + dy_px;
      item.el.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`;
    });
  }, []);

  const handleDragStop = useCallback((id: string, d: any) => {
    setIsDraggingOrResizing(false);
    setIsMouseDragging(false);
    const { activeDesign: currentDesign, selectedElementIds: currentIds } = stateRef.current;
    if (!currentDesign) return;

    const startPos = dragStartPositions.current[id];
    if (!startPos) return;

    const dx = (d.x / MM) - startPos.x;
    const dy = (d.y / MM) - startPos.y;

    const newElements = currentDesign.elements.map(el => {
      if (currentIds.includes(el.id)) {
        const start = dragStartPositions.current[el.id];
        if (start) {
          let newX = Number((start.x + dx).toFixed(1));
          let newY = Number((start.y + dy).toFixed(1));
          newX = Math.max(0, Math.min(86 - (el.w || 20), newX));
          newY = Math.max(0, Math.min(54 - (el.h || 3), newY));
          return { ...el, x: newX, y: newY };
        }
      }
      return el;
    });

    updateActiveDesignWithHistory({ ...currentDesign, elements: newElements });
    dragStartDOMPositions.current = [];
    dragStartPositions.current = {};
  }, []);

  // Export Design to JSON file
  const handleExportDesign = () => {
    if (!activeDesign) return;
    
    const exportData = {
      name: activeDesign.name,
      section: activeDesign.section,
      primaryColor: activeDesign.primary_color,
      secondaryColor: activeDesign.secondary_color,
      showTemplate: activeDesign.show_template,
      elements: activeDesign.elements.map(el => ({
        campo_bd: el.campo_bd,
        label: el.label,
        tipo: el.tipo,
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        color: el.color,
        font_size: el.font_size,
        font_weight: el.font_weight,
        alignment: el.alignment,
        is_visible: el.is_visible,
        fixed_text: el.fixed_text,
      }))
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(exportData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${activeDesign.name.replace(/\s+/g, '_')}_design.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Diseño exportado correctamente');
  };

  // Import Design from JSON file
  const handleImportDesign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDesign) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        
        if (!imported.elements || !Array.isArray(imported.elements)) {
          throw new Error('El archivo JSON no tiene un formato de diseño válido.');
        }

        const newElements = imported.elements.map((el: any, i: number) => ({
          id: `ve-${Date.now()}-${i}`,
          design_id: activeDesign.id,
          campo_bd: el.campo_bd || 'fullName',
          label: el.label || 'Campo',
          tipo: el.tipo || 'texto',
          x: Number(el.x) || 0,
          y: Number(el.y) || 0,
          w: Number(el.w) || 20,
          h: Number(el.h) || 3,
          color: el.color || '#000000',
          font_size: Number(el.font_size) || 8,
          font_weight: el.font_weight || 'normal',
          alignment: el.alignment || 'left',
          is_visible: el.is_visible !== false,
          fixed_text: el.fixed_text || null,
          sort_order: i,
        }));

        updateActiveDesignWithHistory({
          ...activeDesign,
          primary_color: imported.primaryColor || activeDesign.primary_color,
          secondary_color: imported.secondaryColor || activeDesign.secondary_color,
          show_template: imported.showTemplate !== undefined ? imported.showTemplate : activeDesign.show_template,
          elements: newElements,
        });

        toast.success('Diseño importado correctamente. ¡Haz clic en "Guardar Diseño" para confirmar!');
      } catch (err: any) {
        toast.error(`Error al importar: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Clear value
  };


  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDesign) return;
    
    const toastId = toast.loading('Optimizando y subiendo fondo en súper alta calidad (600 DPI)...');
    try {
      // 1. Load image into HTML Image object
      const img = new Image();
      const objectURL = URL.createObjectURL(file);
      img.src = objectURL;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      // 2. Create canvas with professional print dimensions (600 DPI: 2032 x 1276)
      const canvas = document.createElement('canvas');
      canvas.width = 2032;
      canvas.height = 1276;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el contexto de canvas.');
      
      // Configure high-quality smoothing for downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw image covering the canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Clean up object URL
      URL.revokeObjectURL(objectURL);
      
      // 3. Convert to PNG blob (lossless compression) to keep logos & text crystal clear
      const optimizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      if (!optimizedBlob) throw new Error('Error al optimizar la imagen.');
      
      // 4. Create upload payload
      const optimizedFile = new File([optimizedBlob], 'fondo_frente.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', optimizedFile);
      
      const res = await fetch('/api/upload-background', { method: 'POST', body: formData });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor (${res.status})`);
      }
      const data = await res.json();
      
      if (data.url) {
        updateActiveDesignWithHistory({ ...activeDesign, background_url: data.url, show_template: false });
        toast.success('Fondo optimizado y subido a 600 DPI', { id: toastId });
      } else {
        throw new Error(data.error || 'No se recibió la URL de la imagen');
      }
    } catch (error: any) {
      console.error('Background upload error:', error);
      toast.error(`Error al subir la imagen: ${error.message || error}`, { id: toastId });
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
      if (newlyCreated) {
        setActiveDesign(newlyCreated);
        setHistory({ past: [], future: [] });
      }
    }
  };

   const deleteDesign = async () => {
    if (!activeDesign) return;
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
      setHistory({ past: [], future: [] });
    } else {
      // Create if none exists
      createNewDesign(section);
    }
  };

  // Centrar horizontalmente los elementos seleccionados
  const handleCenterSelectedX = () => {
    if (!activeDesign) return;
    const idsToCenter = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
    if (idsToCenter.length === 0) {
      toast.info('Selecciona al menos un elemento para centrar');
      return;
    }

    const newElements = activeDesign.elements.map(el => {
      if (idsToCenter.includes(el.id)) {
        // Card is 86mm wide. Center is at (86 - w) / 2
        const w = el.w || 20;
        const newX = Number(((86 - w) / 2).toFixed(1));
        return { ...el, x: newX };
      }
      return el;
    });

    updateActiveDesignWithHistory({ ...activeDesign, elements: newElements });
    toast.success(idsToCenter.length === 1 ? 'Elemento centrado horizontalmente' : 'Elementos centrados horizontalmente');
  };

  // Distribuir verticalmente de manera equitativa (misma distancia/brecha)
  const handleDistributeSelectedY = () => {
    if (!activeDesign) return;
    const idsToDistribute = selectedElementIds.length > 0 ? selectedElementIds : [];
    if (idsToDistribute.length < 3) {
      toast.info('Selecciona al menos 3 elementos para distribuir el espacio vertical');
      return;
    }

    // Filter elements that are selected and visible
    const els = activeDesign.elements
      .filter(el => idsToDistribute.includes(el.id))
      .sort((a, b) => a.y - b.y);

    const N = els.length;
    const y0 = els[0].y;
    const yLast = els[N - 1].y;
    const hLast = els[N - 1].h || 3;
    const totalSpan = yLast + hLast - y0;

    // Sum of heights of all selected elements
    const totalHeight = els.reduce((sum, el) => sum + (el.h || 3), 0);

    // Total gap space
    const totalGap = totalSpan - totalHeight;

    if (totalGap < 0) {
      toast.error('No hay suficiente espacio vertical entre el primer y último elemento para distribuirlos');
      return;
    }

    const gap = totalGap / (N - 1);

    let currentY = y0;
    const distributedPositions: { [id: string]: number } = {};

    els.forEach((el, idx) => {
      distributedPositions[el.id] = Number(currentY.toFixed(1));
      currentY += (el.h || 3) + gap;
    });

    const newElements = activeDesign.elements.map(el => {
      if (idsToDistribute.includes(el.id)) {
        return { ...el, y: distributedPositions[el.id] };
      }
      return el;
    });

    updateActiveDesignWithHistory({ ...activeDesign, elements: newElements });
    toast.success('Elementos distribuidos verticalmente con espacios iguales');
  };

  if (!activeDesign) {
    return <div className="flex items-center justify-center h-full text-gray-400 font-bold">Cargando diseños...</div>;
  }

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
              <Select value={activeDesign.id} onValueChange={v => { const d = designs.find(x => x.id === v); if (d) { setActiveDesign(d); setHistory({ past: [], future: [] }); } }}>
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
            <Switch checked={(activeDesign.show_template as any) !== false && (activeDesign.show_template as any) !== 0} onCheckedChange={v => updateActiveDesignWithHistory({ ...activeDesign, show_template: v })} />
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

          {/* Alineación y Distribución */}
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50 space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-blue-950 flex items-center gap-1.5">
              Alineación y Distribución
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCenterSelectedX}
                disabled={!selectedElementId && selectedElementIds.length === 0}
                className="h-8 text-[9px] uppercase font-black tracking-wider text-gray-700 bg-white border-gray-200 flex gap-1 items-center justify-center hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700 active:scale-95"
              >
                <AlignCenter className="w-3.5 h-3.5 text-blue-600" /> Centrar X
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDistributeSelectedY}
                disabled={selectedElementIds.length < 3}
                className="h-8 text-[9px] uppercase font-black tracking-wider text-gray-700 bg-white border-gray-200 flex gap-1 items-center justify-center hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700 active:scale-95"
              >
                <MoveVertical className="w-3.5 h-3.5 text-blue-600" /> Distribuir Y
              </Button>
            </div>
          </div>

          {/* Import / Export Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Input 
                type="file" 
                accept=".json" 
                onChange={handleImportDesign}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <Button type="button" variant="outline" className="w-full h-10 rounded-xl text-[9px] uppercase font-black tracking-wider text-gray-600 border-gray-200 flex gap-1.5 items-center justify-center hover:bg-gray-50 active:scale-95">
                <Upload className="w-3.5 h-3.5 text-blue-600" /> Importar
              </Button>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleExportDesign}
              className="w-full h-10 rounded-xl text-[9px] uppercase font-black tracking-wider text-gray-600 border-gray-200 flex gap-1.5 items-center justify-center hover:bg-gray-50 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" /> Exportar
            </Button>
          </div>


          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[9px] font-bold uppercase text-gray-400">Primario</Label>
              <div className="flex gap-1 mt-1">
                <Input type="color" value={activeDesign.primary_color} onChange={e => updateActiveDesignWithHistory({ ...activeDesign, primary_color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" />
                <Input value={activeDesign.primary_color} onChange={e => updateActiveDesignWithHistory({ ...activeDesign, primary_color: e.target.value })} className="h-9 text-[10px] rounded-lg flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[9px] font-bold uppercase text-gray-400">Secundario</Label>
              <div className="flex gap-1 mt-1">
                <Input type="color" value={activeDesign.secondary_color} onChange={e => updateActiveDesignWithHistory({ ...activeDesign, secondary_color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" />
                <Input value={activeDesign.secondary_color} onChange={e => updateActiveDesignWithHistory({ ...activeDesign, secondary_color: e.target.value })} className="h-9 text-[10px] rounded-lg flex-1" />
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
                <Button variant="ghost" size="icon" onClick={() => updateActiveDesignWithHistory({ ...activeDesign, background_url: undefined })} className="h-9 w-9 text-red-400 hover:text-red-600 rounded-xl">
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
              className={`bg-white rounded-xl border overflow-hidden flex-shrink-0 cursor-pointer transition-colors ${selectedElementIds.includes(el.id) ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-100 hover:border-blue-200'}`}
              onClick={(e) => handleSelectElement(el.id, e.ctrlKey || e.shiftKey)}
            >
              <div className={`flex items-center justify-between px-3 py-2 ${selectedElementIds.includes(el.id) ? 'bg-blue-50' : 'border-b border-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className={`text-[10px] font-black uppercase ${selectedElementIds.includes(el.id) ? 'text-blue-700' : 'text-gray-600'}`}>{el.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={!!el.is_visible} onCheckedChange={v => updateElement(idx, { is_visible: v as any })} />
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeElement(idx); }} className="w-7 h-7 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {el.is_visible && selectedElementId === el.id && (
                <div className="p-3 grid grid-cols-4 gap-2 bg-white" onClick={(e) => e.stopPropagation()}>
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
                  {el.campo_bd === 'fixed_text' && (
                    <div className="col-span-4 mt-1 border-t border-gray-100 pt-2">
                      <Label className="text-[8px] font-bold text-gray-400 uppercase">Contenido del Texto Fijo</Label>
                      <Input 
                        type="text"
                        value={el.fixed_text || ''} 
                        onChange={e => updateElement(idx, { fixed_text: e.target.value })} 
                        className="h-8 text-[10px] rounded-lg mt-1"
                        placeholder="Escribe el texto aquí..."
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

      {/* Right Preview */}
      <div className="flex-1 bg-[#e8e8e8] flex items-center justify-center p-8 relative" style={{ backgroundImage: 'linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%), linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}>
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full z-10 shadow-lg border border-gray-100 flex items-center gap-3">
          <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
            <Button
              variant="ghost"
              size="icon"
              disabled={history.past.length === 0}
              onClick={undo}
              className="h-7 w-7 rounded-lg text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 hover:bg-gray-100"
              title="Deshacer (Ctrl + Z)"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={history.future.length === 0}
              onClick={redo}
              className="h-7 w-7 rounded-lg text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 hover:bg-gray-100"
              title="Rehacer (Ctrl + Y / Ctrl + Shift + Z)"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>
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
          {((activeDesign.show_template as any) !== false && (activeDesign.show_template as any) !== 0) && (
            <>
              <div className="absolute top-0 left-0 right-0 pointer-events-none opacity-30 z-0 flex flex-col" style={{ height: `${13 * MM}px`, backgroundColor: activeDesign.primary_color || '#003366', borderBottom: `${0.5 * MM}px solid #eab308` }}>
                 <span className="m-auto text-white font-bold" style={{ fontSize: `${2.5 * MM}px`}}>ZONA DE ENCABEZADO FIJO</span>
              </div>
              <div className="absolute pointer-events-none opacity-30 z-0 bg-gray-200 flex items-center justify-center" style={{ top: `${16 * MM}px`, left: `${4 * MM}px`, width: `${24 * MM}px`, height: `${28 * MM}px`, border: `${0.8 * MM}px solid ${activeDesign.primary_color || '#003366'}` }}>
                 <span className="text-gray-500 font-bold" style={{ fontSize: `${2.5 * MM}px`}}>FOTO FIJA</span>
              </div>
            </>
          )}

          {/* Alignment Guides */}
          {showGuides && isDraggingOrResizing && guidesX.map(gx => (
            <div 
              key={`guide-x-${gx}`} 
              className="absolute top-0 bottom-0 border-l border-dashed border-emerald-500 z-40 pointer-events-none"
              style={{ left: `${gx * MM}px`, opacity: 0.8 }}
            />
          ))}
          {showGuides && isDraggingOrResizing && guidesY.map(gy => (
            <div 
              key={`guide-y-${gy}`} 
              className="absolute left-0 right-0 border-t border-dashed border-emerald-500 z-40 pointer-events-none"
              style={{ top: `${gy * MM}px`, opacity: 0.8 }}
            />
          ))}

          {/* Interactive Elements */}

          {isReady && activeDesign.elements.map((el, idx) => el.is_visible && (
            <Rnd
              id={`rnd-${el.id}`}
              key={`${el.id}-${el.x}-${el.y}`}
              bounds="parent"
              size={{ width: el.w * MM, height: el.h * MM }}
              position={{ x: el.x * MM, y: el.y * MM }}
              onDragStart={() => handleDragStart(el.id)}
              onDrag={(e, d) => handleDrag(el.id, d)}
              onDragStop={(e, d) => handleDragStop(el.id, d)}
              onResizeStart={() => setIsDraggingOrResizing(true)}
              onResizeStop={(e, dir, ref, delta, position) => {
                setIsDraggingOrResizing(false);
                updateElement(idx, { 
                  w: Number((parseFloat(ref.style.width) / MM).toFixed(1)), 
                  h: Number((parseFloat(ref.style.height) / MM).toFixed(1)),
                  x: Number((position.x / MM).toFixed(1)),
                  y: Number((position.y / MM).toFixed(1))
                });
              }}
              className={`group ${selectedElementIds.includes(el.id) ? 'ring-1 ring-blue-500 z-50' : 'z-10'}`}
              style={{ position: 'absolute' }}
              onClick={(e: any) => {
                e.stopPropagation();
                handleSelectElement(el.id, e.ctrlKey || e.shiftKey);
              }}
            >
              <div className={`absolute inset-0 border border-transparent group-hover:border-blue-400 group-hover:bg-blue-400/10 cursor-move transition-colors ${selectedElementIds.includes(el.id) ? 'border-blue-500 bg-blue-500/5' : ''}`} />
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
                     {(() => {
                       if (el.fixed_text) return el.fixed_text;
                       if (el.campo_bd === 'emision') {
                         const date = new Date();
                         const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                         return `${months[date.getMonth()]} ${date.getFullYear()}`;
                       }
                       if (el.campo_bd === 'vigencia') {
                         const date = new Date();
                         const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                         return `${months[date.getMonth()]} ${date.getFullYear() + 1}`;
                       }
                       return (mockMember[el.campo_bd as keyof Member] as string) || `[${el.label}]`;
                     })()}
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
