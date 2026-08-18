'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Member, CredentialDesign } from '@/types/member';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateVectorialCredentialPDF, generateVectorialBatchCredentialsPDF, mapDesignToConfig } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { Search, ArrowLeft, Printer, Eye, RefreshCw, Layers, QrCode, History, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function PrintDirectoryPanel({ inline = false, onClose = () => {} }: { inline?: boolean; onClose?: () => void }) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Column Filters
  const [filterNomina, setFilterNomina] = useState('');
  const [filterNombre, setFilterNombre] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterPuesto, setFilterPuesto] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('');

  // Print Configuration & Batch States
  const [printMode, setPrintMode] = useState<'both' | 'front_only'>('both');
  const [qrType, setQrType] = useState<'new' | 'legacy'>('new');
  const [designs, setDesigns] = useState<CredentialDesign[]>([]);
  const [selectedFrontDesignId, setSelectedFrontDesignId] = useState<string>('');
  const [selectedBackDesignId, setSelectedBackDesignId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Preview & Printing Modal
  const [previewMember, setPreviewMember] = useState<Member | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page when column filters change
  useEffect(() => {
    setPage(1);
  }, [filterNomina, filterNombre, filterTipo, filterEstado, filterPuesto, filterDepartamento]);

  // Load credential designs
  useEffect(() => {
    fetch('/api/settings/designs')
      .then(res => res.json())
      .then((data: CredentialDesign[]) => {
        if (Array.isArray(data)) {
          setDesigns(data);
          const activeFront = data.find(d => (d.section || 'frente') === 'frente' && d.is_active);
          const activeBack = data.find(d => d.section === 'reverso' && d.is_active);
          
          if (activeFront) setSelectedFrontDesignId(activeFront.id);
          else {
            const firstFront = data.find(d => (d.section || 'frente') === 'frente');
            if (firstFront) setSelectedFrontDesignId(firstFront.id);
          }

          if (activeBack) setSelectedBackDesignId(activeBack.id);
          else {
            const firstBack = data.find(d => d.section === 'reverso');
            if (firstBack) setSelectedBackDesignId(firstBack.id);
          }
        }
      })
      .catch(err => console.error('Error cargando diseños:', err));
  }, []);

  let fetchUrl = `/api/members?page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`;
  if (filterNomina) fetchUrl += `&employeeId=${encodeURIComponent(filterNomina)}`;
  if (filterNombre) fetchUrl += `&search=${encodeURIComponent(filterNombre)}`;
  if (filterTipo) fetchUrl += `&memberType=${encodeURIComponent(filterTipo)}`;
  if (filterEstado) fetchUrl += `&status=${encodeURIComponent(filterEstado)}`;
  if (filterPuesto) fetchUrl += `&position=${encodeURIComponent(filterPuesto)}`;
  if (filterDepartamento) fetchUrl += `&department=${encodeURIComponent(filterDepartamento)}`;

  const { data, isLoading } = useSWR(fetchUrl, fetcher);
  const members: Member[] = data?.data || [];
  const totalPages = data?.totalPages || data?.meta?.totalPages || 1;

  // Checkbox Selection Logic
  const allSelectedOnPage = members.length > 0 && members.every(m => selectedIds.includes(m.id));
  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds(prev => prev.filter(id => !members.some(m => m.id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...members.map(m => m.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelectMember = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Batch Print function
  const handlePrintBatch = async () => {
    if (selectedIds.length === 0) return;
    const selectedMembers = members.filter(m => selectedIds.includes(m.id));
    if (selectedMembers.length === 0) return;

    setIsPrinting(true);
    try {
      const frontDesign = designs.find(d => d.id === selectedFrontDesignId) || designs.find(d => (d.section || 'frente') === 'frente');
      const backDesign = printMode === 'both' ? (designs.find(d => d.id === selectedBackDesignId) || designs.find(d => d.section === 'reverso')) : null;

      if (!frontDesign) {
        toast.error('No se encontró una plantilla de diseño de credencial');
        setIsPrinting(false);
        return;
      }

      const frontConfig = mapDesignToConfig(frontDesign);
      const backConfig = backDesign ? mapDesignToConfig(backDesign) : null;

      toast.info(`Generando PDF masivo para ${selectedMembers.length} agremiados...`);
      await generateVectorialBatchCredentialsPDF(
        selectedMembers,
        frontConfig,
        backConfig,
        `Credenciales_Masivas_${selectedMembers.length}_Agremiados`,
        qrType
      );
      toast.success(`PDF generado exitosamente con ${selectedMembers.length} credenciales.`);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar las credenciales masivas');
    } finally {
      setIsPrinting(false);
    }
  };

  // Print function for Single Member
  const handlePrintMember = async (member: Member) => {
    setIsPrinting(true);
    try {
      const frontDesign = designs.find(d => d.id === selectedFrontDesignId) || designs.find(d => (d.section || 'frente') === 'frente');
      const backDesign = printMode === 'both' ? (designs.find(d => d.id === selectedBackDesignId) || designs.find(d => d.section === 'reverso')) : null;

      if (!frontDesign) {
        toast.error('No se encontró una plantilla de diseño de credencial');
        setIsPrinting(false);
        return;
      }

      const frontConfig = mapDesignToConfig(frontDesign);
      const backConfig = backDesign ? mapDesignToConfig(backDesign) : null;

      toast.info(`Generando PDF para ${member.fullName}...`);
      await generateVectorialCredentialPDF(
        member,
        frontConfig,
        backConfig,
        `Credencial_${member.employeeId || 'SUTSMBJ'}_${member.fullName.replace(/ /g, '_')}`,
        qrType
      );
      toast.success('Credencial lista e impresa con éxito.');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar la credencial');
    } finally {
      setIsPrinting(false);
    }
  };

  const frontDesigns = designs.filter(d => (d.section || 'frente') === 'frente');

  return (
    <div className={inline ? "h-full flex flex-col bg-white min-h-0 w-full" : "min-h-screen bg-gray-50 flex flex-col"}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          {inline ? (
            <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Button>
          ) : (
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-black text-emerald-950 flex items-center gap-2.5 uppercase tracking-tight">
              <Printer className="w-7 h-7 text-emerald-600" />
              Impresión de Credenciales
            </h1>
            <p className="text-xs text-gray-500 font-medium">Búsqueda rápida y emisión de credenciales de agremiados</p>
          </div>
        </div>

        {/* Global Print Options Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-emerald-50/60 p-2 rounded-2xl border border-emerald-100/80">
          {/* Print Mode Selector */}
          <div className="flex items-center bg-white rounded-xl p-1 border border-emerald-200/60 shadow-sm">
            <button
              onClick={() => setPrintMode('both')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                printMode === 'both'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
              title="Imprimir ambas caras (Frente y Reverso)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ambas Caras</span>
            </button>
            <button
              onClick={() => setPrintMode('front_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                printMode === 'front_only'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
              title="Imprimir únicamente la cara frontal"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Solo Frente</span>
            </button>
          </div>

          {/* QR Code Selector */}
          <div className="flex items-center bg-white rounded-xl p-1 border border-emerald-200/60 shadow-sm">
            <button
              onClick={() => setQrType('new')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                qrType === 'new'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
              title="Generar código QR nuevo estructurado"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Nuevo</span>
            </button>
            <button
              onClick={() => setQrType('legacy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                qrType === 'legacy'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
              title="Usar código QR anterior almacenado previamente"
            >
              <History className="w-3.5 h-3.5" />
              <span>QR Anterior</span>
            </button>
          </div>

          {/* Front Design Selector */}
          {frontDesigns.length > 1 && (
            <select
              value={selectedFrontDesignId}
              onChange={(e) => setSelectedFrontDesignId(e.target.value)}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-white border border-emerald-200 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {frontDesigns.map(d => (
                <option key={d.id} value={d.id}>Diseño: {d.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={inline ? "flex-1 p-6 flex flex-col gap-6 overflow-y-auto min-h-0 bg-gray-50/10 w-full" : "flex-1 p-6 flex flex-col max-w-7xl mx-auto w-full gap-6"}>
        {/* Search Bar */}
        <div className="relative group bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 flex items-center">
          <Search className="absolute left-6 w-5 h-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="Buscar por nombre, nómina, puesto, departamento..." 
            className="pl-12 border-none shadow-none focus-visible:ring-0 text-lg h-12 rounded-[1.5rem]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table Container */}
        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/40 flex-1 overflow-hidden flex flex-col relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/90 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="w-[45px] text-center px-3 py-4">
                      <button
                        onClick={toggleSelectAll}
                        className="text-emerald-700 hover:text-emerald-900 transition-colors inline-flex items-center justify-center"
                        title={allSelectedOnPage ? "Deseleccionar todos en esta página" : "Seleccionar todos en esta página"}
                      >
                        {allSelectedOnPage ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                      </button>
                    </th>
                    <th className="w-[60px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Foto</th>
                    <th className="w-[100px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Nómina</th>
                    <th className="min-w-[180px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Nombre Completo</th>
                    <th className="w-[140px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Tipo</th>
                    <th className="w-[110px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Estado</th>
                    <th className="min-w-[150px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Puesto</th>
                    <th className="min-w-[150px] font-black text-emerald-950 uppercase text-[10px] tracking-widest px-3 py-4">Departamento</th>
                    <th className="text-right font-black text-emerald-950 uppercase text-[10px] tracking-widest px-4 py-4 w-[170px] sticky right-0 bg-gray-50/95 backdrop-blur-sm z-20 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)]">Imprimir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.length > 0 ? (
                    members.map((member) => {
                      const isSelected = selectedIds.includes(member.id);
                      return (
                        <tr key={member.id} className={`hover:bg-emerald-50/40 transition-colors group ${isSelected ? 'bg-emerald-50/60' : ''}`}>
                          {/* Checkbox */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => toggleSelectMember(member.id)}
                              className="text-emerald-700 hover:text-emerald-900 transition-colors inline-flex items-center justify-center"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-gray-300 group-hover:text-emerald-400" />}
                            </button>
                          </td>
                        {/* Foto */}
                        <td className="py-3 px-3">
                          {member.photoUrl ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-all shrink-0">
                              <img src={`${member.photoUrl}?t=${new Date().getTime()}`} alt={member.fullName} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center text-xs font-black uppercase shadow-inner group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all shrink-0">
                              {member.fullName.charAt(0)}
                            </div>
                          )}
                        </td>

                        {/* Nómina */}
                        <td className="py-3 px-3">
                          <span className="font-mono text-xs font-black px-2 py-1 bg-gray-100 text-gray-700 rounded-md border border-gray-200 whitespace-nowrap">
                            {member.employeeId}
                          </span>
                        </td>

                        {/* Nombre Completo */}
                        <td className="py-3 px-3 max-w-[220px]">
                          <span className="font-bold text-gray-900 text-xs block truncate" title={member.fullName}>{member.fullName}</span>
                        </td>

                        {/* Tipo de Agremiado */}
                        <td className="py-3 px-3">
                          {member.memberType === 'SECRETARIO GENERAL' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 whitespace-nowrap">
                              Secretario General
                            </span>
                          )}
                          {member.memberType === 'DELEGADO' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200 whitespace-nowrap">
                              Delegado
                            </span>
                          )}
                          {member.memberType === 'LISTA DE ESPERA' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full border border-orange-200 whitespace-nowrap">
                              Lista de Espera
                            </span>
                          )}
                          {member.memberType === 'AGREMIADO' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 whitespace-nowrap">
                              Agremiado
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3">
                          {member.status === 'ACTIVO' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 whitespace-nowrap">
                              Activo
                            </span>
                          )}
                          {member.status === 'BAJA' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-red-100 text-red-700 rounded-full border border-red-200 whitespace-nowrap">
                              Baja
                            </span>
                          )}
                          {member.status === 'JUBILADO/PENSIONADO' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 whitespace-nowrap">
                              Jubilado
                            </span>
                          )}
                          {member.status === 'INCAPACITADO' && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200 whitespace-nowrap">
                              Incapacitado
                            </span>
                          )}
                          {(!member.status || member.status === 'N/A') && (
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 whitespace-nowrap">
                              N/A
                            </span>
                          )}
                        </td>

                        {/* Puesto */}
                        <td className="py-3 px-3 max-w-[200px]">
                          <span className="text-gray-600 text-xs font-medium block truncate" title={member.position || '---'}>
                            {member.position || '---'}
                          </span>
                        </td>

                        {/* Departamento */}
                        <td className="py-3 px-3 max-w-[200px]">
                          <span className="text-gray-500 text-xs font-medium italic block truncate" title={member.department || '---'}>
                            {member.department || '---'}
                          </span>
                        </td>

                        {/* Acción Imprimir Sticky a la Derecha */}
                        <td className="py-3 px-4 text-right sticky right-0 bg-white group-hover:bg-emerald-50/90 z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)]">
                          <div className="flex justify-end items-center gap-2 shrink-0">
                            <Button
                              onClick={() => setPreviewMember(member)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 rounded-xl border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 font-bold gap-1 text-xs shrink-0"
                              title="Previsualizar Credencial"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Ver</span>
                            </Button>
                            <Button
                              onClick={() => handlePrintMember(member)}
                              disabled={isPrinting}
                              size="sm"
                              className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm shadow-emerald-200 shrink-0"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimir</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Printer className="w-10 h-10 text-gray-300 stroke-1" />
                          <p className="font-bold text-gray-600">No se encontraron agremiados para imprimir.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Floating Action Bar for Batch Printing */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-950/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 border border-emerald-700/50">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                {selectedIds.length} agremiado{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              <Button
                onClick={handlePrintBatch}
                disabled={isPrinting}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black rounded-full text-xs h-9 px-5 gap-2 shadow-lg transition-all transform hover:scale-105"
              >
                <Printer className="w-4 h-4" />
                <span>IMPRIMIR CREDENCIALES SELECCIONADAS ({selectedIds.length})</span>
              </Button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-emerald-300 hover:text-white text-xs font-bold underline pl-2"
              >
                Deseleccionar
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white text-xs font-bold text-gray-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
                variant="outline" 
                size="sm"
                className="rounded-xl h-8 text-xs font-bold"
              >
                Anterior
              </Button>
              <Button 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => p + 1)}
                variant="outline" 
                size="sm"
                className="rounded-xl h-8 text-xs font-bold"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewMember && (
        <Dialog open={!!previewMember} onOpenChange={() => setPreviewMember(null)}>
          <DialogContent className="max-w-lg rounded-3xl p-6 bg-white border border-gray-100 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-emerald-950 uppercase flex items-center gap-2">
                <Printer className="w-6 h-6 text-emerald-600" />
                Previsualización de Credencial
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 my-2">
              {/* Member Basic Info summary */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                {previewMember.photoUrl ? (
                  <img src={previewMember.photoUrl} alt={previewMember.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-base uppercase">
                    {previewMember.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900">{previewMember.fullName}</h4>
                  <p className="text-xs text-gray-500">Nómina: <span className="font-mono font-bold text-gray-700">{previewMember.employeeId}</span> | {previewMember.position || 'Sin puesto'}</p>
                </div>
              </div>

              {/* Print Modes Selector inside Modal */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold">
                <span className="text-gray-600">Modo de Impresión:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrintMode('both')}
                    className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                      printMode === 'both' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    Ambas Caras
                  </button>
                  <button
                    onClick={() => setPrintMode('front_only')}
                    className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                      printMode === 'front_only' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    Solo Frente
                  </button>
                </div>
              </div>

              {/* QR Code Selector inside Modal */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Código QR:</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQrType('new')}
                    className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                      qrType === 'new' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    QR Nuevo
                  </button>
                  <button
                    onClick={() => setQrType('legacy')}
                    className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                      qrType === 'legacy' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    QR Anterior
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewMember(null)}
                  className="flex-1 rounded-2xl h-11 font-bold border-gray-200"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    await handlePrintMember(previewMember);
                    setPreviewMember(null);
                  }}
                  disabled={isPrinting}
                  className="flex-1 rounded-2xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-200 gap-2"
                >
                  <Printer className="w-5 h-5" />
                  <span>Imprimir PDF</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
