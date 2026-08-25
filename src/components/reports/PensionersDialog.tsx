'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Users, X, Printer, ArrowLeft, Search, FileSpreadsheet, Filter, Calendar, Layers } from 'lucide-react';
import { Member } from '@/types/member';
import { generateResumePDF, generatePensionersReportPDF } from '@/lib/pdf-generator';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import Link from 'next/link';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export function PensionersDialog({ isOpen = false, onClose = () => {}, inline = false }: Props) {
  const [list, setList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberForPreview, setSelectedMemberForPreview] = useState<any | null>(null);

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [pctFilter, setPctFilter] = useState<string>('all');

  useEffect(() => {
    if (isOpen || inline) calc();
  }, [isOpen, inline]);

  const parseDate = (dateStr: string | any) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') return new Date(dateStr);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    const parts = dateStr.toString().split(/[-/]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      const p2 = parseInt(parts[2]);
      
      if (parts[0].length === 4) return new Date(p0, p1 - 1, p2);
      if (parts[2].length === 4) return new Date(p2, p1 - 1, p0);
    }
    return null;
  };

  const calc = async () => {
    setIsLoading(true);
    try {
      const types = ['ACTIVO', 'DELEGADO', 'SECRETARIO_GENERAL'];
      const responses = await Promise.all(
        types.map(t => fetch(`/api/members?limit=2000&memberType=${t}`))
      );
      
      const results = await Promise.all(responses.map(r => r.json()));
      const allMembers: Member[] = results.flatMap(d => d.data || []);
      
      const rStatus = await fetch('/api/members?limit=2000&status=ACTIVO');
      const dStatus = await rStatus.json();
      const statusActive = dStatus.data || [];
      
      const rIncap = await fetch('/api/members?limit=2000&status=INCAPACITADO');
      const dIncap = await rIncap.json();
      const statusIncap = dIncap.data || [];
      
      const merged = [...allMembers, ...statusActive, ...statusIncap];
      const uniqueIds = new Set();
      const uniqueMembers = merged.filter(m => {
        if (uniqueIds.has(m.id)) return false;
        uniqueIds.add(m.id);
        return true;
      });

      const today = new Date();
      const currentYear = today.getFullYear();

      const filtered = uniqueMembers.filter(m => {
        const bDate = parseDate(m.birthDate);
        const jDate = parseDate(m.joinDate);
        if (!jDate) return false;

        let years = today.getFullYear() - jDate.getFullYear();
        if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;

        const isIncapacitated = m.status === 'INCAPACITADO';
        if (isIncapacitated) {
          return years >= 10;
        }

        if (!bDate) return false;
        let age = today.getFullYear() - bDate.getFullYear();
        if (today < new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
        
        return age > 50 && years >= 15;
      }).map(m => {
        const bDate = parseDate(m.birthDate);
        const jDate = parseDate(m.joinDate)!;
        
        let age = 0;
        if (bDate) {
          age = today.getFullYear() - bDate.getFullYear();
          if (today < new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
        }
        
        let years = today.getFullYear() - jDate.getFullYear();
        if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;
        
        const isIncapacitated = m.status === 'INCAPACITADO';

        // Calculate estimated year of eligibility
        const reqSeniorityYears = isIncapacitated ? 10 : 15;
        const reqAgeYears = isIncapacitated ? 0 : 51;
        const missingSeniority = Math.max(0, reqSeniorityYears - years);
        const missingAge = Math.max(0, reqAgeYears - age);
        const missingTotal = Math.max(missingSeniority, missingAge);
        const estimatedYear = currentYear + missingTotal;
        
        return { 
          ...m, 
          calculatedAge: age, 
          calculatedYears: years, 
          estimatedYear,
          pensionPct: isIncapacitated ? 100 : (years >= 24 ? 100 : 75),
          pensionType: isIncapacitated ? 'INCAPACIDAD' : 'EDAD Y ANTIGÜEDAD'
        };
      }).sort((a, b) => b.calculatedYears - a.calculatedYears);
      
      setList(filtered);
    } catch (e) {
      console.error('Pension Calc Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter List Logic
  const filteredList = list.filter(m => {
    // Text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (m.fullName || '').toLowerCase().includes(term);
      const matchEmp = (m.employeeId || '').toLowerCase().includes(term);
      const matchPos = (m.position || '').toLowerCase().includes(term);
      const matchDept = (m.department || '').toLowerCase().includes(term);
      if (!matchName && !matchEmp && !matchPos && !matchDept) return false;
    }

    // % Pension filter
    if (pctFilter !== 'all') {
      if (pctFilter === 'INCAPACIDAD' && m.pensionType !== 'INCAPACIDAD') return false;
      if (pctFilter === '100' && (m.pensionPct !== 100 || m.pensionType === 'INCAPACIDAD')) return false;
      if (pctFilter === '75' && m.pensionPct !== 75) return false;
    }

    // Estimated Year filter
    if (yearFilter !== 'all') {
      const estYear = m.estimatedYear || 2026;
      if (yearFilter === '2026' && estYear !== 2026) return false;
      if (yearFilter === '2027' && estYear !== 2027) return false;
      if (yearFilter === '2028' && estYear !== 2028) return false;
      if (yearFilter === '2029+' && estYear < 2029) return false;
    }

    return true;
  });

  const getFilterTitle = () => {
    let title = 'Reporte de Proyección de Pensiones';
    if (yearFilter !== 'all') {
      if (yearFilter === '2026') title += ' - Jubilaciones 2026 (Este Año)';
      else if (yearFilter === '2027') title += ' - Jubilaciones 2027 (Próximo Año)';
      else if (yearFilter === '2028') title += ' - Jubilaciones 2028 (En 2 Años)';
      else if (yearFilter === '2029+') title += ' - Jubilaciones 2029 en adelante';
    }
    if (pctFilter !== 'all') {
      title += ` (${pctFilter === 'INCAPACIDAD' ? 'Incapacidad' : pctFilter + '% Pensión'})`;
    }
    return title;
  };

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const headers = ['Nómina', 'Nombre Completo', 'Puesto', 'Departamento', 'Edad', 'Antigüedad', 'Fecha Ingreso', 'Sueldo', '% Pensión', 'Tipo', 'Año Jubilación Estimado'];
    const rows = filteredList.map(m => [
      `"${m.employeeId || ''}"`,
      `"${(m.fullName || '').replace(/"/g, '""')}"`,
      `"${(m.position || '').replace(/"/g, '""')}"`,
      `"${(m.department || '').replace(/"/g, '""')}"`,
      m.calculatedAge,
      m.calculatedYears,
      `"${m.joinDate || m.altaSindicato || ''}"`,
      m.salary || 0,
      `"${m.pensionPct}%"`,
      `"${m.pensionType}"`,
      m.estimatedYear || 2026
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Proyeccion_Pensiones_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportados ${filteredList.length} registros a Excel.`);
  };

  const handlePrintPDF = () => {
    if (filteredList.length === 0) {
      toast.error('No hay agremiados para generar el reporte');
      return;
    }
    generatePensionersReportPDF(filteredList, getFilterTitle());
  };

  const pensionersContent = (
    <div className={inline ? "w-full bg-white border border-gray-100 shadow-xl rounded-[2rem] overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[600px]" : "max-w-[95vw] md:max-w-7xl h-[90vh] rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-gray-50/98 backdrop-blur-xl flex flex-col"}>
      {/* Header */}
      <div className="px-5 py-5 md:px-10 md:py-6 bg-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          {inline && (
            onClose ? (
              <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : (
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            )
          )}
          <div className="flex-1">
            <h2 className="text-xl md:text-3xl font-black text-blue-900 uppercase tracking-tighter flex items-center gap-3 md:gap-4">
              <Users className="w-7 h-7 md:w-9 md:h-9 text-cyan-600 shrink-0" />
              Proyección de Pensiones
            </h2>
            <p className="text-[9px] md:text-[10px] text-gray-400 font-black uppercase tracking-widest italic leading-tight mt-1">
              Edad y Antigüedad (&gt;50 años / &gt;=15 años serv.) o por Incapacidad (&gt;=10 años serv.)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrintPDF}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Reporte PDF</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="h-10 px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-black text-xs rounded-xl flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel</span>
          </Button>

          {!inline && (
            <button onClick={onClose} className="w-10 h-10 shrink-0 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 ml-2">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="px-5 py-3 md:px-10 bg-blue-900/5 border-b border-blue-100/60 flex flex-col md:flex-row items-center gap-3 shrink-0">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, nómina, puesto o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-white border-gray-200 text-xs font-bold text-gray-800 placeholder:text-gray-400 focus-visible:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 h-10 text-xs font-bold text-gray-700 w-1/2 md:w-auto">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold w-full"
            >
              <option value="all">Todos los Años</option>
              <option value="2026">Elegibles 2026 (Este Año)</option>
              <option value="2027">Elegibles 2027 (Próximo Año)</option>
              <option value="2028">Elegibles 2028 (En 2 Años)</option>
              <option value="2029+">Elegibles 2029 en adelante</option>
            </select>
          </div>

          {/* % Pension Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 h-10 text-xs font-bold text-gray-700 w-1/2 md:w-auto">
            <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={pctFilter}
              onChange={(e) => setPctFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold w-full"
            >
              <option value="all">Todas las Categorías</option>
              <option value="100">100% Pensión (24+ Años)</option>
              <option value="75">75% Pensión (15-23 Años)</option>
              <option value="INCAPACIDAD">Por Incapacidad (10+ Años)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Sub-header */}
      <div className="px-5 py-2 md:px-10 bg-white border-b border-gray-100 text-[11px] font-bold text-gray-500 flex justify-between items-center shrink-0">
        <span>Mostrando <strong className="text-blue-900">{filteredList.length}</strong> de <strong className="text-gray-700">{list.length}</strong> elegibles a pensión</span>
        {(searchTerm || yearFilter !== 'all' || pctFilter !== 'all') && (
          <button
            onClick={() => { setSearchTerm(''); setYearFilter('all'); setPctFilter('all'); }}
            className="text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-wider underline"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-gray-50/30 scrollbar-premium min-h-0">
        <style jsx global>{`
          .scrollbar-premium::-webkit-scrollbar {
            width: 8px;
          }
          .scrollbar-premium::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.03);
            border-radius: 10px;
          }
          .scrollbar-premium::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.1);
            border-radius: 10px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          .scrollbar-premium::-webkit-scrollbar-thumb:hover {
            background: rgba(0,0,0,0.2);
            border: 2px solid transparent;
            background-clip: padding-box;
          }
        `}</style>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-xs font-bold text-gray-500 mt-4">Calculando proyección de pensiones...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredList.map((m, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-xl hover:border-blue-200 transition-all duration-500 flex flex-col justify-between">
                <div>
                  {m.pensionType === 'INCAPACIDAD' ? (
                    <div className="absolute top-0 left-0 px-4 py-2 rounded-br-3xl bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
                      Incapacidad
                    </div>
                  ) : null}
                  
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-white text-[10px] font-black uppercase tracking-widest shadow-sm ${m.pensionPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                    {m.pensionPct}% Pensión
                  </div>
                  
                  <div className="flex items-center gap-4 mb-6 mt-2">
                    <div className="w-16 h-16 rounded-2xl border-2 border-gray-50 overflow-hidden shadow-inner bg-gray-50 shrink-0">
                      {m.photoUrl ? <img src={m.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-xl">{m.fullName.charAt(0)}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-blue-900 uppercase text-sm truncate leading-tight mb-1" title={m.fullName}>{m.fullName}</h4>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest italic truncate">{m.position}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                      <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-1 text-center">Edad</p>
                      <p className="text-xl font-black text-blue-900 text-center">{m.calculatedAge} <span className="text-[10px] opacity-50 uppercase">años</span></p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                      <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mb-1 text-center">Antigüedad</p>
                      <p className="text-xl font-black text-blue-900 text-center">{m.calculatedYears} <span className="text-[10px] opacity-50 uppercase">años</span></p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between items-center mb-4 text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-black uppercase">Ingreso</span>
                      <span className="text-slate-700 font-bold">{m.joinDate || m.altaSindicato}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-gray-400 font-black uppercase">Nómina</span>
                      <span className="text-slate-700 font-bold">#{m.employeeId}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedMemberForPreview(m)}
                  className="w-full py-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 group-hover:bg-blue-600 group-hover:text-white shadow-sm shadow-blue-100 mt-2"
                >
                  <Printer className="w-4 h-4" />
                  Previsualizar Expediente
                </button>
              </div>
            ))}
            {filteredList.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3 stroke-1" />
                <p className="text-gray-400 font-black uppercase tracking-widest italic">No se encontraron agremiados con los filtros seleccionados</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {inline ? (
        pensionersContent
      ) : (
        <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
          <DialogContent showCloseButton={false} className="max-w-[95vw] md:max-w-7xl h-[90vh] rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-gray-50/98 backdrop-blur-xl flex flex-col">
            {pensionersContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Real-time Expediente Preview Dialog */}
      <Dialog open={selectedMemberForPreview !== null} onOpenChange={o => !o && setSelectedMemberForPreview(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[85vh] rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 md:px-8 md:py-6 bg-blue-900 text-white flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-400 shrink-0" />
                Previsualización de Expediente
              </h3>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">
                Verifica la información antes de generar el documento final
              </p>
            </div>
            <button 
              onClick={() => setSelectedMemberForPreview(null)} 
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 text-white transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Paper View Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50 flex justify-center items-start scrollbar-premium">
            <div className="w-full max-w-[210mm] bg-white border border-gray-200/60 shadow-lg rounded-2xl p-8 flex flex-col font-sans text-gray-800 text-sm">
              {/* Center Logo */}
              <div className="mb-6 flex justify-center">
                <img 
                  src="/logos/logo2.png" 
                  alt="Sindicato Logo" 
                  className="h-16 w-auto object-contain max-w-[250px]"
                />
              </div>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-black text-blue-900 text-center uppercase tracking-tight">
                EXPEDIENTE DEL AGREMIADO
              </h2>
              
              <div className="w-full h-[1px] bg-gray-200 my-4" />

              {/* INFORMACIÓN GENERAL */}
              <div className="mb-6">
                <h4 className="text-sm font-black text-blue-900 uppercase mb-2 tracking-wide">INFORMACIÓN GENERAL</h4>
                <div className="w-full h-[2px] bg-blue-900 mb-4" />
                
                <div className="flex flex-col-reverse md:flex-row gap-6">
                  {/* Left fields */}
                  <div className="flex-1 space-y-2.5">
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Nombre:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.fullName || '---'}</span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">CURP:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.curp || '---'}</span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">No. Nómina:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.employeeId || '---'}</span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Edad:</span>
                      <span className="text-gray-900 font-semibold">
                        {(() => {
                          const bDate = parseDate(selectedMemberForPreview?.birthDate);
                          if (!bDate) return '---';
                          const today = new Date();
                          let age = today.getFullYear() - bDate.getFullYear();
                          if (today < new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
                          return `${age} años`;
                        })()}
                      </span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Antigüedad:</span>
                      <span className="text-gray-900 font-semibold">
                        {(() => {
                          const jDate = parseDate(selectedMemberForPreview?.joinDate || selectedMemberForPreview?.altaSindicato);
                          if (!jDate) return '---';
                          const today = new Date();
                          let years = today.getFullYear() - jDate.getFullYear();
                          if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;
                          return `${Math.max(0, years)} años`;
                        })()}
                      </span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Fecha Ingreso:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.joinDate || selectedMemberForPreview?.altaSindicato || '---'}</span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Sueldo:</span>
                      <span className="text-gray-900 font-semibold">
                        {selectedMemberForPreview?.salary !== undefined && selectedMemberForPreview?.salary !== null && selectedMemberForPreview?.salary !== 0
                          ? `$${Number(selectedMemberForPreview.salary).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '---'}
                      </span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Puesto Actual:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.position || '---'}</span>
                    </div>
                    <div className="flex border-b border-gray-100 py-1">
                      <span className="w-32 font-bold text-gray-700">Departamento:</span>
                      <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.department || '---'}</span>
                    </div>
                  </div>

                  {/* Photo area */}
                  <div className="shrink-0 flex justify-center items-start">
                    <div className="w-[120px] h-[140px] border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center relative shadow-sm">
                      {selectedMemberForPreview?.photoUrl ? (
                        <img 
                          src={`${selectedMemberForPreview.photoUrl}?t=${new Date().getTime()}`} 
                          alt="Foto" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider">SIN FOTO</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DATOS DE CONTACTO */}
              <div className="mb-6">
                <h4 className="text-sm font-black text-blue-900 uppercase mb-2 tracking-wide">DATOS DE CONTACTO</h4>
                <div className="w-full h-[2px] bg-blue-900 mb-4" />
                
                <div className="space-y-2.5">
                  <div className="flex border-b border-gray-100 py-1">
                    <span className="w-32 font-bold text-gray-700">Teléfono:</span>
                    <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.phone || '---'}</span>
                  </div>
                  <div className="flex border-b border-gray-100 py-1">
                    <span className="w-32 font-bold text-gray-700">Email:</span>
                    <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.email || '---'}</span>
                  </div>
                  <div className="flex border-b border-gray-100 py-1">
                    <span className="w-32 font-bold text-gray-700">Domicilio:</span>
                    <span className="text-gray-900 font-semibold">{selectedMemberForPreview?.address || '---'}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                Uso exclusivo del Sindicato Único de Trabajadores.
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 md:px-8 md:py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
            <Button
              onClick={() => setSelectedMemberForPreview(null)}
              variant="outline"
              className="h-11 px-6 rounded-xl text-gray-500 font-bold text-xs uppercase tracking-wider"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedMemberForPreview) {
                  generateResumePDF(selectedMemberForPreview);
                }
              }}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Printer className="w-4 h-4" />
              Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
