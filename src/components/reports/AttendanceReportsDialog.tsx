'use client';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Gift, ClipboardCheck, User as UserIcon, Plus, Trash2, Users, FileText, Eye, QrCode } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Member } from '@/types/member';
import { toast } from 'sonner';
import { QRScanner } from './QRScanner';

interface Props { isOpen: boolean; onClose: () => void; initialTab?: TabType; }
type TabType = 'busqueda' | 'cumpleanos' | 'asistencia';
interface AttRecord { id: string; name: string; date: string; created_at: string; }
interface EventRecord { id: string; name: string; date: string; attendee_count: number; }

export function AttendanceReportsDialog({ isOpen, onClose, initialTab = 'busqueda' }: Props) {
  const [tab, setTab] = useState<TabType>(initialTab);
  
  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [sq, setSq] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [bdays, setBdays] = useState<Member[]>([]);
  const [selMember, setSelMember] = useState<any>(null);
  const [attData, setAttData] = useState<AttRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [captureEvent, setCaptureEvent] = useState<EventRecord|null>(null);
  const [captureNomina, setCaptureNomina] = useState('');
  const [captureList, setCaptureList] = useState<any[]>([]);
  const [captureCount, setCaptureCount] = useState(0);
  const [newEvtName, setNewEvtName] = useState('');
  const [newEvtDate, setNewEvtDate] = useState(new Date().toISOString().slice(0,10));
  const [showNewEvt, setShowNewEvt] = useState(false);
  const [viewEvent, setViewEvent] = useState<EventRecord|null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attSearch, setAttSearch] = useState('');
  const [searchingMember, setSearchingMember] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const captureRef = useRef<any>(null);

  useEffect(() => { 
    if (isOpen && tab === 'cumpleanos') {
      calcBdays();
    } 
  }, [isOpen, tab]);

  const calcBdays = async () => {
    try {
      const r = await fetch('/api/members?limit=3000');
      const d = await r.json();
      const allMembers: Member[] = d.data || [];
      const today = new Date(); const yr = today.getFullYear();
      const up = allMembers.filter(m => {
        if (!m.birthDate || m.status !== 'ACTIVO') return false;
        const [y,mo,d] = m.birthDate.split('-');
        if (!mo||!d) return false;
        const bd = new Date(yr, +mo-1, +d);
        if (bd < new Date(yr, today.getMonth(), today.getDate())) bd.setFullYear(yr+1);
        const diff = Math.ceil((bd.getTime()-today.getTime())/(864e5));
        return diff >= 0 && diff <= 7;
      }).sort((a,b) => {
        const g = (m:Member) => { const [,mo,d]=m.birthDate!.split('-'); const bd=new Date(yr,+mo-1,+d); if(bd<new Date(yr,today.getMonth(),today.getDate()))bd.setFullYear(yr+1); return bd.getTime(); };
        return g(a)-g(b);
      });
      setBdays(up);
    } catch (e) {
      toast.error('Error cargando cumpleaños');
    }
  };

  const doSearch = async () => {
    setSelMember(null);
    setAttData([]);
    if (!sq.trim()) { setResults([]); return; }
    try {
      const r = await fetch(`/api/members?search=${encodeURIComponent(sq)}`);
      const d = await r.json();
      setResults(d.data || []);
    } catch {
      toast.error('Error en búsqueda');
    }
  };

  const loadAtt = async (nomina: string) => {
    setAttLoading(true); setSelMember(null); setAttData([]);
    try {
      const r = await fetch(`/api/attendance?employeeId=${nomina}`);
      const d = await r.json();
      if (d.success) { setSelMember(d.member || results.find((m: Member)=>m.employeeId===nomina)); setAttData(d.attendance); }
    } catch { toast.error('Error cargando asistencias'); }
    finally { setAttLoading(false); }
  };

  const loadEvents = async () => {
    try {
      const r = await fetch('/api/attendance?action=listEvents');
      const d = await r.json();
      if (d.success) setEvents(d.events);
    } catch { toast.error('Error cargando eventos'); }
  };

  const createEvent = async () => {
    if (!newEvtName.trim()||!newEvtDate.trim()) { toast.error('Nombre y fecha requeridos'); return; }
    
    const yr = newEvtDate.split('-')[0];
    let finalName = newEvtName.trim();
    if (!finalName.includes(yr)) {
      finalName = `${finalName} ${yr}`;
    }

    try {
      const r = await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'createEvent',name:finalName,date:newEvtDate}) });
      const d = await r.json();
      if (d.success) { toast.success('Evento creado'); setNewEvtName(''); setShowNewEvt(false); loadEvents(); setCaptureEvent({id:d.id,name:d.name,date:d.date,attendee_count:0}); setCaptureList([]); setCaptureCount(0); }
    } catch { toast.error('Error creando evento'); }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento y todas sus asistencias?')) return;
    try {
      await fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'deleteEvent',eventId:id}) });
      toast.success('Evento eliminado'); loadEvents();
    } catch { toast.error('Error'); }
  };

  const loadAttendees = async (ev: EventRecord) => {
    setViewEvent(ev);
    setLoadingAttendees(true);
    setAttendees([]);
    try {
      const r = await fetch(`/api/attendance?action=eventAttendees&eventId=${ev.id}`);
      const d = await r.json();
      if (d.success) setAttendees(d.attendees);
    } catch { toast.error('Error al cargar asistentes'); }
    finally { setLoadingAttendees(false); }
  };

  const handleQRResult = (text: string) => {
    let nomina = text.trim();
    
    // If the QR contains multiple fields (e.g. NÓMINA: 1234), extract the value
    if (text.includes('NÓMINA:')) {
      const match = text.match(/NÓMINA:\s*(.*)/i);
      if (match && match[1]) {
        nomina = match[1].trim();
      }
    }
    
    setCaptureNomina(nomina);
    searchMemberForAttendance(nomina);
  };

  const searchMemberForAttendance = async (overrideNomina?: string) => {
    const nominaToSearch = overrideNomina || captureNomina.trim();
    if (!nominaToSearch || !captureEvent) return;
    setIsSearching(true);
    try {
      const r = await fetch(`/api/attendance?employeeId=${nominaToSearch}`);
      const d = await r.json();
      if (d.success && d.member) {
        setSearchingMember(d.member);
      } else {
        toast.error('Miembro no encontrado');
        setCaptureNomina('');
        captureRef.current?.focus();
      }
    } catch {
      toast.error('Error buscando miembro');
    } finally {
      setIsSearching(false);
    }
  };

  const addCapture = async () => {
    if (!searchingMember || !captureEvent) return;
    try {
      const r = await fetch('/api/attendance', { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify({
          action:'addAttendance',
          eventId:captureEvent.id,
          employeeId:searchingMember.employeeId
        }) 
      });
      const d = await r.json();
      if (d.success) {
        setCaptureList(prev => [{nomina:searchingMember.employeeId, ...d.member}, ...prev]);
        setCaptureCount(d.totalAttendees);
        toast.success(`${d.member?.fullName || searchingMember.fullName} registrado`);
        setSearchingMember(null);
        setCaptureNomina('');
        setTimeout(() => captureRef.current?.focus(), 100);
      } else if (d.duplicate) {
        toast.warning(`${d.member?.fullName || searchingMember.fullName} ya está registrado`);
        setSearchingMember(null);
        setCaptureNomina('');
        setTimeout(() => captureRef.current?.focus(), 100);
      }
    } catch { 
      toast.error('Error registrando'); 
    }
  };

  const getMemberTypeLabel = (type: string) => {
    switch (type) {
      case 'SECRETARIO_GENERAL': return 'Secretario General';
      case 'DELEGADO': return 'Delegado';
      case 'ACTIVO': return 'Agremiado';
      case 'ESPERA': return 'Lista de Espera';
      case 'PENSIONADO': return 'Pensionado';
      default: return type || 'Agremiado';
    }
  };

  const generatePDF = async () => {
    if (!selMember) return;
    toast.info('Generando vista previa...'); 
    
    const w = window.open('', '_blank');
    if (!w) { toast.error('Popup bloqueado'); return; }

    const evtList = attData.map(e => `<li style="padding:4px 0">${e.name}</li>`).join('');

    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte de Asistencia - ${selMember.employeeId}</title>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.4; background: #fff; }
        .report-container { width: 100%; max-width: 900px; margin: 0 auto; }
        
        .header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
        .logo-center { flex: 1; text-align: center; }
        .logo-img { width: 450px; height: auto; }
        .photo-right { width: 150px; text-align: right; }
        .photo-right .photo-box { width: 140px; height: 175px; border: 1px solid #ccc; border-radius: 15px; background-size: cover; background-position: center; background-repeat: no-repeat; margin-left: auto; }
        .no-photo-placeholder { width: 140px; height: 175px; border: 1px solid #ccc; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999; background: #f8fafc; margin-left: auto; }
        
        .page-title { text-align: center; font-size: 26px; font-weight: bold; margin: 40px 0; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        
        .data-grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .data-grid td { padding: 12px 0; font-size: 17px; width: 50%; font-weight: bold; }
        .label { color: #333; }
        .val { text-transform: uppercase; color: #000; }
        
        .history-bar { background: #1e40af; color: white; padding: 15px 20px; font-weight: bold; font-size: 18px; text-transform: uppercase; margin-top: 10px; }
        
        .attendance-list { list-style: none; padding: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border: 1px solid #e5e7eb; border-top: none; }
        .attendance-list li { font-size: 14px; font-weight: bold; color: #1f2937; display: flex; align-items: center; gap: 8px; }
        .attendance-list li::before { content: "✓"; color: #059669; font-size: 18px; }
        
        @media print { 
          .actions-bar { display: none; }
          body { padding: 0; }
          .report-container { max-width: 100%; margin: 0; }
        }
        .actions-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
        .btn { border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-size: 14px; transition: all 0.2s; }
        .btn-print { background: #1e40af; color: white; }
        .btn-download { background: #059669; color: white; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 10px -1px rgba(0,0,0,0.15); }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <script>
        function downloadPDF() {
          const element = document.querySelector('.report-container');
          const opt = {
            margin: 10,
            filename: 'Reporte_Asistencia_${selMember.employeeId}.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          html2pdf().set(opt).from(element).save();
        }
      </script>
    </head>
    <body>
      <div class="actions-bar">
        <button class="btn btn-download" onclick="downloadPDF()">Descargar PDF</button>
        <button class="btn btn-print" onclick="window.print()">Imprimir Reporte</button>
      </div>
      <div class="report-container">
        <div class="header-container">
          <div style="width: 150px;"></div>
          <div class="logo-center">
            <img src="/logos/logo2.png" class="logo-img">
          </div>
          <div class="photo-right">
            ${selMember.photoUrl 
              ? `<div class="photo-box" style="background-image: url('${selMember.photoUrl}')"></div>`
              : `<div class="no-photo-placeholder">SIN FOTO</div>`}
          </div>
        </div>

        <div class="page-title">PERFIL DE AGREMIADO</div>

        <table class="data-grid">
          <tr>
            <td><span class="label">Nombre:</span> <span class="val">${selMember.fullName || 'N/A'}</span></td>
            <td><span class="label">Nomina:</span> <span class="val">${selMember.employeeId || 'N/A'}</span></td>
          </tr>
          <tr>
            <td><span class="label">Secretaría:</span> <span class="val">${selMember.department || 'N/A'}</span></td>
            <td><span class="label">Puesto:</span> <span class="val">${selMember.position || 'N/A'}</span></td>
          </tr>
          <tr>
            <td><span class="label">Tipo de miembro:</span> <span class="val">${getMemberTypeLabel(selMember.memberType)}</span></td>
            <td><span class="label">Estado de agremiado:</span> <span class="val">${selMember.status || 'ACTIVO'}</span></td>
          </tr>
        </table>

        <div class="history-bar">HISTORIAL DE PARTICIPACIÓN</div>
        <ul class="attendance-list">
          ${evtList || '<li style="grid-column: span 2; text-align: center; color: #999">No se encontraron registros de asistencia.</li>'}
        </ul>
      </div>
    </body>
    </html>
    `);
    w.document.close();
  };

  const getAge = (bd: string) => { const t=new Date(),b=new Date(bd); let a=t.getFullYear()-b.getFullYear(); const m=t.getMonth()-b.getMonth(); if(m<0||(m===0&&t.getDate()<b.getDate()))a--; return a; };
  const getBdayText = (bd: string) => {
    const t=new Date(),yr=t.getFullYear(),[,mo,d]=bd.split('-');
    const b=new Date(yr,+mo-1,+d); if(b<new Date(yr,t.getMonth(),t.getDate()))b.setFullYear(yr+1);
    const diff=Math.ceil((b.getTime()-t.getTime())/864e5);
    const ds=b.toLocaleDateString('es-ES',{day:'numeric',month:'long'});
    if(diff===0)return`Hoy (${ds})`; if(diff===1)return`Mañana (${ds})`; return`En ${diff} días (${ds})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] md:h-[85vh] rounded-[2rem] border border-gray-200 shadow-2xl p-0 overflow-hidden bg-white flex flex-col-reverse md:flex-row">
        {/* Sidebar / Bottom Nav on mobile */}
        <div className="w-full md:w-64 bg-[#1E293B] flex flex-row md:flex-col shrink-0 text-white shadow-2xl z-20">
          <div className="hidden md:flex p-6 flex-col gap-1 border-b border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center p-1.5 backdrop-blur-sm border border-white/10">
                <img src="/logos/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic">SICS</h2>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">Gestión Integral SUTSMBJ</p>
          </div>
          <nav className="flex-1 px-2 py-2 md:mt-6 md:px-3 flex flex-row md:flex-col gap-2 justify-around md:justify-start overflow-x-auto">
            {([
              ['busqueda','Consultar',Search],
              ['cumpleanos','Cumpleaños',Gift],
              ['asistencia','Asistencia',ClipboardCheck]
            ] as const).map(([k,l,Icon])=>(
              <button key={k} onClick={()=>{setTab(k as TabType); if(k==='asistencia')loadEvents();}}
                className={`flex-1 md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3.5 rounded-xl transition-all duration-300 ${tab===k?'bg-blue-600 text-white shadow-lg shadow-blue-900/40 md:translate-x-1':'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <Icon className={`w-5 h-5 md:w-4 md:h-4 ${tab===k?'text-white':'text-gray-500 group-hover:text-white'}`} />
                <span className="text-[10px] md:text-sm font-bold tracking-tight">{l}</span>
              </button>
            ))}
          </nav>
          <div className="hidden md:block p-6 border-t border-white/5">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-1">Versión del Sistema</p>
              <p className="text-xs text-blue-400 font-black">v2.6 PREMIUM BUILD</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden relative min-h-0">
          <div className="absolute top-4 right-4 md:top-6 md:right-8 z-10 scale-75 md:scale-100 origin-top-right">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Base de Datos 2026</span>
            </div>
          </div>

          {/* TAB: BÚSQUEDA */}
          {tab === 'busqueda' && (
            <div className="p-4 md:p-10 flex-1 overflow-y-auto">
              <div className="mb-6 md:mb-10">
                <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Consultar Agremiado</h2>
                <p className="text-gray-400 text-xs md:text-sm font-medium">Gestión Integral de Información Sindical SUTSMBJ</p>
              </div>
              
              <div className="bg-gray-50/50 rounded-2xl p-4 md:p-8 border border-gray-100 mb-6 md:mb-8">
                <label className="text-[10px] md:text-xs font-semibold text-gray-600 mb-1 block">Búsqueda Rápida</label>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Buscar agremiados, nóminas..." className="pl-9 h-11 rounded-lg" value={sq} onChange={e=>setSq(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} />
                  </div>
                  <Button onClick={doSearch} className="h-11 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm w-full md:w-auto">Buscar</Button>
                </div>
              </div>

              {/* Member profile + attendance when selected */}
              {selMember && (
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-5 mb-5 pb-5 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-500 overflow-hidden shrink-0">
                        {selMember.photoUrl ? <img src={`${selMember.photoUrl}?t=${new Date().getTime()}`} alt="" className="w-full h-full object-cover"/> : selMember.fullName?.charAt(0)}
                      </div>
                      <div className="flex-1 md:hidden">
                        <h3 className="text-lg font-bold text-slate-800 leading-tight">{selMember.fullName}</h3>
                      </div>
                    </div>
                    <div className="flex-1 hidden md:block">
                      <h3 className="text-xl font-bold text-slate-800">{selMember.fullName}</h3>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="bg-gray-100 px-2.5 py-1 rounded text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nómina: {selMember.employeeId||'N/A'}</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 font-bold uppercase ml-1">Tipo de miembro</span>
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-tight">{getMemberTypeLabel(selMember.memberType)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 font-bold uppercase ml-1">Estado de agremiado</span>
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-tight">{selMember.status}</span>
                        </div>
                      </div>
                    </div>
                    {/* Mobile details */}
                    <div className="flex md:hidden items-center gap-2 flex-wrap">
                      <span className="bg-gray-100 px-2.5 py-1 rounded text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nómina: {selMember.employeeId||'N/A'}</span>
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight">{getMemberTypeLabel(selMember.memberType)}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight">{selMember.status}</span>
                    </div>
                    <Button onClick={generatePDF} variant="outline" className="w-full md:w-auto gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                      <FileText className="w-4 h-4"/>Generar PDF
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 text-sm md:text-base">Historial de Eventos Asistidos</h4>
                    <span className="text-[10px] md:text-xs font-medium text-blue-600 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">Total: {attData.length}</span>
                  </div>
                  {attData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {attData.map((e,i) => (
                        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-blue-50/50 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><ClipboardCheck className="w-4 h-4"/></div>
                          <p className="font-semibold text-slate-700 text-[10px] md:text-xs">{e.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                      <ClipboardCheck className="w-8 h-8 md:w-10 md:h-10 text-gray-300 mx-auto mb-2"/>
                      <p className="text-gray-400 text-xs md:text-sm">Sin registros de asistencia.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Search results */}
              {!selMember && (
                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 md:mb-3">Resultados</h3>
                  {results.length>0 && <p className="text-[10px] md:text-xs text-gray-400 mb-3">{results.length} resultado(s)</p>}
                  <div className="flex flex-col gap-2">
                    {results.map(m => (
                      <div key={m.id} onClick={()=>loadAtt(m.employeeId||m.id)} className="bg-white p-3 md:p-3.5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0">
                            {m.photoUrl?<img src={`${m.photoUrl}?t=${new Date().getTime()}`} alt="" className="w-full h-full object-cover"/>:m.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-slate-800 font-bold text-xs md:text-sm group-hover:text-blue-600 transition-colors truncate">{m.fullName}</h4>
                            <p className="text-[10px] md:text-xs text-gray-400">Nómina: {m.employeeId||'N/A'}</p>
                          </div>
                        </div>
                        <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[8px] text-gray-400 font-bold uppercase">Tipo de miembro</span>
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">{getMemberTypeLabel(m.memberType)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {attLoading && <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>}
            </div>
          )}

          {/* TAB: CUMPLEAÑOS */}
          {tab === 'cumpleanos' && (
            <div className="p-4 md:p-10 flex-1 overflow-y-auto">
              <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-100 flex items-center justify-center shadow-inner border border-amber-200 shrink-0">
                  <Gift className="w-6 h-6 md:w-8 md:h-8 text-amber-600"/>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Cumpleaños de la Semana</h2>
                  <p className="text-gray-400 text-sm font-medium italic">Celebrando a nuestros agremiados activos • Próximos 7 días</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bdays.map((m,i) => (
                  <div key={m.id} className={`bg-white p-4 rounded-xl shadow-sm border ${i===0?'border-blue-300 bg-blue-50/30':'border-gray-100'} flex gap-3 items-center`}>
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {m.photoUrl?<img src={`${m.photoUrl}?t=${new Date().getTime()}`} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-gray-400"><UserIcon className="w-7 h-7"/></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="font-bold text-slate-800 text-sm truncate pr-2">{m.fullName}</h4>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${i===0?'text-blue-600':'text-slate-500'}`}>{getBdayText(m.birthDate!)}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-1">Nómina: {m.employeeId} • {m.memberType}</p>
                      <p className="text-xs font-medium text-blue-600">Cumple {getAge(m.birthDate!)+1} años</p>
                    </div>
                  </div>
                ))}
                {bdays.length===0 && <div className="col-span-2 text-center py-10 text-gray-400">No hay cumpleaños en los próximos 7 días.</div>}
              </div>
            </div>
          )}

          {/* TAB: ASISTENCIA (create/manage events) */}
          {tab === 'asistencia' && !captureEvent && !viewEvent && (
            <div className="p-4 md:p-10 flex-1 overflow-y-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-10">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Control de Asistencia</h2>
                  <p className="text-gray-400 text-xs md:text-sm font-medium">Registro y gestión de eventos institucionales.</p>
                </div>
                <Button onClick={()=>setShowNewEvt(!showNewEvt)} className="w-full md:w-auto gap-2 bg-blue-600 hover:bg-blue-700 h-12 px-6 rounded-xl font-bold shadow-lg shadow-blue-200 uppercase text-xs tracking-wider transition-all hover:scale-105 active:scale-95"><Plus className="w-4 h-4"/>Crear Evento</Button>
              </div>
              {showNewEvt && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
                  <h3 className="font-bold text-slate-800 mb-4">Nuevo Evento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre del Evento</label><Input value={newEvtName} onChange={e=>setNewEvtName(e.target.value)} placeholder="Ej. Junta Extraordinaria"/></div>
                    <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha (YYYY-MM-DD)</label><Input type="date" value={newEvtDate} onChange={e=>setNewEvtDate(e.target.value)}/></div>
                  </div>
                  <Button onClick={createEvent} className="bg-emerald-600 hover:bg-emerald-700">Crear y Comenzar Captura</Button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {events.map(ev => (
                  <div key={ev.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-blue-200 transition-all gap-4">
                    <div className="cursor-pointer w-full md:flex-1" onClick={()=>loadAttendees(ev)}>
                      <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">{ev.name}</h4>
                      <p className="text-[10px] md:text-xs text-gray-400">{ev.date} • {ev.attendee_count} asistentes</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      <Button size="sm" variant="outline" onClick={()=>loadAttendees(ev)} className="flex-1 md:flex-none text-xs gap-1 border-blue-100 text-blue-600 hover:bg-blue-50"><Eye className="w-3.5 h-3.5"/>Lista</Button>
                      <Button size="sm" variant="outline" onClick={()=>{setCaptureEvent(ev);setCaptureList([]);setCaptureCount(ev.attendee_count);}} className="flex-1 md:flex-none text-xs gap-1"><Users className="w-3.5 h-3.5"/>Capturar</Button>
                    </div>
                  </div>
                ))}
                {events.length===0 && <div className="text-center py-10 text-gray-400">No hay eventos. Crea uno para empezar.</div>}
              </div>
            </div>
          )}



          {/* View Attendees List */}
          {tab === 'asistencia' && viewEvent && (
            <div className="p-4 md:p-6 flex-1 overflow-y-auto bg-gray-50/50">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 md:mb-6">
                <button onClick={()=>setViewEvent(null)} className="flex items-center gap-2 text-xs md:text-sm text-gray-500 hover:text-slate-800 font-semibold transition-colors">
                  <Plus className="w-4 h-4 rotate-45"/> Volver a eventos
                </button>
                <div className="text-left md:text-right">
                  <h2 className="text-lg md:text-xl font-bold text-slate-800">{viewEvent.name}</h2>
                  <p className="text-[10px] md:text-xs text-gray-500">{viewEvent.date} • {attendees.length} asistentes registrados</p>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Buscar en la lista de asistencia..." 
                  className="pl-9 h-11 bg-white border-gray-200 rounded-lg shadow-sm"
                  value={attSearch}
                  onChange={e=>setAttSearch(e.target.value)}
                />
              </div>

              {loadingAttendees ? (
                <div className="text-center py-20 text-gray-400">Cargando asistentes...</div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px] md:min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 md:px-4 py-3 font-bold text-slate-700">Nómina</th>
                        <th className="px-3 md:px-4 py-3 font-bold text-slate-700">Nombre</th>
                        <th className="px-3 md:px-4 py-3 font-bold text-slate-700">Tipo / Estatus</th>
                        <th className="px-3 md:px-4 py-3 font-bold text-slate-700">Hora Registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attendees
                        .filter(a => !attSearch || a.full_name?.toLowerCase().includes(attSearch.toLowerCase()) || a.employee_id?.includes(attSearch))
                        .map((a, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-3 md:px-4 py-3 font-mono text-xs font-bold text-slate-600">{a.employee_id}</td>
                          <td className="px-3 md:px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-100 flex items-center justify-center text-[8px] md:text-[10px] font-bold overflow-hidden shrink-0">
                                {a.photo_url ? <img src={`${a.photo_url}?t=${new Date().getTime()}`} className="w-full h-full object-cover"/> : a.full_name?.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-800 text-[10px] md:text-sm truncate max-w-[120px] md:max-w-none">{a.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-blue-600">{getMemberTypeLabel(a.member_type)}</span>
                              <span className="text-[9px] text-gray-400 font-medium">{a.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {new Date(a.created_at).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}
                          </td>
                        </tr>
                      ))}
                      {attendees.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-10 text-gray-400 italic">No hay registros para este evento.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Capture mode */}
          {tab === 'asistencia' && captureEvent && (
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <button onClick={()=>{setCaptureEvent(null); setSearchingMember(null);}} className="text-xs md:text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 rotate-45"/> Volver a eventos
              </button>
              
              <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-8 shadow-xl border border-gray-100 mb-6 md:mb-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 md:mb-6 gap-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-blue-900 uppercase tracking-tighter">Captura: {captureEvent.name}</h2>
                    <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">{captureCount} asistentes registrados</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Sesión de Captura Activa</span>
                  </div>
                </div>

                {!searchingMember ? (
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input 
                        ref={captureRef} 
                        value={captureNomina} 
                        onChange={e=>setCaptureNomina(e.target.value)} 
                        onKeyDown={e=>e.key==='Enter'&&searchMemberForAttendance()} 
                        placeholder="Escanea o escribe nómina..." 
                        className="h-14 md:h-16 pl-12 text-lg md:text-2xl font-black text-blue-900 border-gray-200 rounded-2xl shadow-inner bg-gray-50/50 w-full" 
                        autoFocus 
                      />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <Button 
                        variant="outline"
                        onClick={() => setShowQR(true)}
                        className="flex-1 md:flex-none h-14 md:h-16 px-4 md:px-6 border-blue-100 text-blue-600 hover:bg-blue-50 rounded-2xl flex md:flex-col items-center justify-center gap-2 md:gap-1 group transition-all"
                      >
                        <QrCode className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] md:text-[9px] font-black uppercase">Escanear QR</span>
                      </Button>
                      <Button 
                        onClick={() => searchMemberForAttendance()} 
                        disabled={isSearching}
                        className="flex-1 md:flex-none h-14 md:h-16 px-6 md:px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSearching ? 'Buscando...' : 'Buscar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <div className="text-center mb-6">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] italic">Verifica los datos y confirma:</span>
                    </div>
                    
                    <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 flex flex-col md:flex-row items-center gap-8 max-w-2xl mx-auto shadow-sm">
                      <div className="w-32 h-40 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-white shrink-0">
                        {searchingMember.photoUrl ? (
                          <img src={`${searchingMember.photoUrl}?t=${new Date().getTime()}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                            <Users className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-black text-blue-900 uppercase leading-tight mb-2">{searchingMember.fullName}</h3>
                        <p className="text-blue-600 font-bold text-sm uppercase tracking-widest mb-4">{searchingMember.position}</p>
                        
                        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase border border-blue-200 tracking-widest mb-6">
                          {getMemberTypeLabel(searchingMember.memberType)}
                        </div>

                        <div className="flex gap-3 justify-center md:justify-start">
                          <Button 
                            onClick={addCapture}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-emerald-200"
                          >
                            Confirmar
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {setSearchingMember(null); setCaptureNomina(''); setTimeout(() => captureRef.current?.focus(), 100);}}
                            className="border-red-100 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest px-8 h-12 rounded-xl"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4">
                <h3 className="font-black text-blue-900 uppercase text-xs tracking-[0.2em] mb-4 flex items-center gap-2 italic">
                  <div className="w-6 h-[1px] bg-blue-200"></div>
                  Registros de esta sesión
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {captureList.map((c,i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow animate-in slide-in-from-top-4 duration-300" style={{animationDelay: `${i * 50}ms`}}>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black border border-emerald-100">
                        {c.fullName ? c.fullName.charAt(0) : '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate uppercase">{c.fullName || 'Desconocido'}</p>
                        <p className="text-[10px] text-gray-400 font-bold tracking-widest">NÓM: {c.nomina} • {getMemberTypeLabel(c.memberType || '')}</p>
                      </div>
                    </div>
                  ))}
                  {captureList.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-300 italic text-sm">
                      Aún no hay registros en esta sesión
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      {showQR && (
        <QRScanner onScan={handleQRResult} onClose={() => setShowQR(false)} />
      )}
    </Dialog>
  );
}
