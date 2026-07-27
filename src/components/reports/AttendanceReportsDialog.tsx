'use client';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Gift, ClipboardCheck, User as UserIcon, Plus, Trash2, Users, FileText, Eye, QrCode, ArrowLeft, Trophy, BarChart3, Download, X, Edit2, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Member } from '@/types/member';
import { toast } from 'sonner';
import { QRScanner } from './QRScanner';
import Link from 'next/link';

interface Props { isOpen?: boolean; onClose?: () => void; initialTab?: TabType; inline?: boolean; onlyShowBirthdays?: boolean; }
type TabType = 'busqueda' | 'cumpleanos' | 'asistencia' | 'top20';
interface AttRecord { id: string; name: string; date: string; created_at: string; }
interface EventRecord { id: string; name: string; date: string; attendee_count: number; }

export function AttendanceReportsDialog({ isOpen = false, onClose = () => {}, initialTab = 'busqueda', inline = false, onlyShowBirthdays = false }: Props) {
  const [tab, setTab] = useState<TabType>(onlyShowBirthdays ? 'cumpleanos' : initialTab);
  
  useEffect(() => {
    if (onlyShowBirthdays) {
      setTab('cumpleanos');
    } else if ((isOpen || inline) && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, inline, initialTab, onlyShowBirthdays]);
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventName, setEditingEventName] = useState<string>('');
  const captureRef = useRef<any>(null);

  // Quejas y Reportes states
  const [complaintsData, setComplaintsData] = useState<any[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<'asistencia' | 'quejas'>('asistencia');
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState<any | null>(null);
  const [complaintDate, setComplaintDate] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintFollowUp, setComplaintFollowUp] = useState('');
  
  const [top20Data, setTop20Data] = useState<any[]>([]);
  const [top20Loading, setTop20Loading] = useState(false);
  const [top20Search, setTop20Search] = useState('');
  const [top20TypeFilter, setTop20TypeFilter] = useState('ALL');
  const [top20SubTab, setTop20SubTab] = useState<'general' | 'espera'>('general');

  useEffect(() => { 
    if ((isOpen || inline) && tab === 'top20') {
      loadTop20();
    } 
  }, [isOpen, inline, tab]);

  const loadTop20 = async () => {
    setTop20Loading(true);
    try {
      const r = await fetch('/api/attendance?action=top20');
      const d = await r.json();
      if (d.success) setTop20Data(d.data || []);
      else toast.error(d.error || 'Error cargando top 20');
    } catch { 
      toast.error('Error cargando top 20'); 
    } finally {
      setTop20Loading(false);
    }
  };

  const getIsPensioner = (item: any) => {
    if (!item.joinDate) return false;
    const today = new Date();
    const parseDateStr = (dateStr: any) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };
    const jDate = parseDateStr(item.joinDate);
    const bDate = parseDateStr(item.birthDate);
    if (!jDate) return false;
    
    let years = today.getFullYear() - jDate.getFullYear();
    if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;
    
    if (item.status === 'INCAPACITADO') {
      return years >= 10;
    }
    
    if (!bDate) return false;
    let age = today.getFullYear() - bDate.getFullYear();
    if (today < new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
    
    return age > 50 && years >= 15;
  };

  const currentTop20Data = top20Data.filter((m: any) => {
    if (top20SubTab === 'espera') {
      return m.memberType === 'LISTA DE ESPERA';
    } else {
      return m.memberType !== 'LISTA DE ESPERA';
    }
  });

  const chartData = currentTop20Data.slice(0, 20);

  const filteredAllAttendees = currentTop20Data.filter((item: any) => {
    const query = top20Search.toLowerCase().trim();
    const matchesSearch = !query || 
      item.fullName.toLowerCase().includes(query) || 
      item.employeeId.toLowerCase().includes(query);
      
    if (top20SubTab === 'espera') {
      return matchesSearch;
    }

    if (top20TypeFilter === 'ALL') return matchesSearch;
    if (top20TypeFilter === 'ACTIVO') return matchesSearch && item.status === 'ACTIVO';
    if (top20TypeFilter === 'DELEGADO') return matchesSearch && item.memberType === 'DELEGADO';
    if (top20TypeFilter === 'BAJA') return matchesSearch && item.status === 'BAJA' && !getIsPensioner(item);
    if (top20TypeFilter === 'PENSIONADO') return matchesSearch && getIsPensioner(item);
    
    return matchesSearch;
  });

  const downloadTop20CSV = () => {
    if (filteredAllAttendees.length === 0) return;
    const headers = ['Posición', 'Nómina', 'Nombre Completo', 'Tipo Miembro', 'Departamento', 'Estatus', 'Asistencias'];
    const rows = filteredAllAttendees.map((item, idx) => [
      idx + 1,
      item.employeeId,
      item.fullName,
      item.memberType,
      item.department,
      item.status,
      item.count
    ]);
    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Top_Asistencias_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel/CSV de asistentes descargado');
  };

  useEffect(() => { 
    if ((isOpen || inline) && tab === 'cumpleanos') {
      calcBdays();
    } 
  }, [isOpen, inline, tab]);

  const calcBdays = async () => {
    try {
      const r = await fetch('/api/members?limit=3000');
      const d = await r.json();
      const allMembers: Member[] = d.data || [];
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const up = allMembers.filter(m => {
        if (!m.birthDate || m.status !== 'ACTIVO') return false;
        const [,mo,d] = m.birthDate.split('-');
        if (!mo||!d) return false;
        return parseInt(mo, 10) === currentMonth;
      }).sort((a,b) => {
        const [, , dA] = a.birthDate!.split('-');
        const [, , dB] = b.birthDate!.split('-');
        return parseInt(dA, 10) - parseInt(dB, 10);
      });
      setBdays(up);
    } catch (e) {
      toast.error('Error cargando cumpleaños');
    }
  };

  const doSearch = async () => {
    setSelMember(null);
    setAttData([]);
    setComplaintsData([]);
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
      const r = await fetch(`/api/attendance?employeeId=${encodeURIComponent(nomina)}`);
      const d = await r.json();
      if (d.success) { 
        setSelMember(d.member || results.find((m: Member)=>m.employeeId===nomina)); 
        const sortedAttendance = (d.attendance || []).sort((a: any, b: any) => {
          const dateA = extractDateFromEventName(a.name);
          const dateB = extractDateFromEventName(b.name);
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return (a.created_at || '').localeCompare(b.created_at || '');
        });
        setAttData(sortedAttendance); 
      }
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

  const saveRename = async (eventId: string) => {
    if (!editingEventName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renameEvent', eventId, name: editingEventName.trim() })
      });
      const d = await res.json();
      if (d.success) {
        toast.success('Evento renombrado');
        setEditingEventId(null);
        loadEvents();
        if (viewEvent && viewEvent.id === eventId) {
          setViewEvent({ ...viewEvent, name: editingEventName.trim() });
        }
        if (captureEvent && captureEvent.id === eventId) {
          setCaptureEvent({ ...captureEvent, name: editingEventName.trim() });
        }
      } else {
        toast.error('Error al renombrar el evento');
      }
    } catch {
      toast.error('Error de red al renombrar el evento');
    }
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
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    let nomina = normalizedText;
    
    // Check if the text is a JSON string (for older credentials or compatibility)
    try {
      if (normalizedText.startsWith('{') && normalizedText.endsWith('}')) {
        const parsed = JSON.parse(normalizedText);
        if (parsed) {
          const val = parsed.nomina || parsed.employeeId;
          if (val) {
            nomina = val.toString().trim();
          }
        }
      }
    } catch (e) {
      console.warn("Failed parsing QR as JSON:", e);
    }
    
    // If the QR contains multiple fields (e.g. NÓMINA: 1234), extract the value
    if (normalizedText.includes('NÓMINA:')) {
      const match = normalizedText.match(/NÓMINA:\s*(.*)/i);
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
      const r = await fetch(`/api/attendance?employeeId=${encodeURIComponent(nominaToSearch)}`);
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

  const MONTHS: Record<string, string> = {
    ENE: '01', ENERO: '01',
    FEB: '02', FEBRERO: '02',
    MAR: '03', MARZO: '03',
    ABR: '04', ABRIL: '04',
    MAY: '05', MAYO: '05',
    JUN: '06', JUNIO: '06',
    JUL: '07', JULIO: '07',
    AGO: '08', AGOSTO: '08',
    SEP: '09', SEPTIEMBRE: '09',
    OCT: '10', OCTUBRE: '10',
    NOV: '11', NOVIEMBRE: '11',
    DIC: '12', DICIEMBRE: '12'
  };

  const extractDateFromEventName = (name: string): string => {
    if (!name) return '1970-01-01';
    const upper = name.toUpperCase().trim();
    
    // 1. Check YYYY-MM-DD
    const ymdMatch = upper.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (ymdMatch) {
      return ymdMatch[0];
    }
    
    // 2. Check DD/MM/YYYY or DD/MM/YY
    const dmyMatch = upper.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (dmyMatch) {
      let day = dmyMatch[1].padStart(2, '0');
      let month = dmyMatch[2].padStart(2, '0');
      let year = dmyMatch[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }
    
    // 3. Check Month-DD-YY or Month-DD-YYYY (e.g. AGO-28-25, ABRIL-10-2025, DIC/11/25)
    const monthNames = Object.keys(MONTHS).join('|');
    const monthDayYearRegex = new RegExp(`\\b(${monthNames})[-/\\s](\\d{1,2})[-/\\s](\\d{2,4})\\b`, 'i');
    const mdyMatch = upper.match(monthDayYearRegex);
    if (mdyMatch) {
      const month = MONTHS[mdyMatch[1]];
      const day = mdyMatch[2].padStart(2, '0');
      let year = mdyMatch[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    // 4. Check DD-Month-YY or DD-Month-YYYY (e.g. 18 FEB 2026)
    const dayMonthYearRegex = new RegExp(`\\b(\\d{1,2})[-/\\s](${monthNames})[-/\\s](\\d{2,4})\\b`, 'i');
    const dmyWordMatch = upper.match(dayMonthYearRegex);
    if (dmyWordMatch) {
      const day = dmyWordMatch[1].padStart(2, '0');
      const month = MONTHS[dmyWordMatch[2]];
      let year = dmyWordMatch[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    // 5. Just a 4-digit year (e.g. SAMS 2025)
    const yearMatch = upper.match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      return `${yearMatch[1]}-01-01`;
    }
    
    return '1970-01-01';
  };

  const getMemberTypeLabel = (type: string) => {
    switch (type) {
      case 'SECRETARIO GENERAL': return 'Secretario General';
      case 'SECRETARIO_GENERAL': return 'Secretario General';
      case 'DELEGADO': return 'Delegado';
      case 'AGREMIADO': return 'Agremiado';
      case 'ACTIVO': return 'Agremiado';
      case 'ESPERA': return 'Lista de Espera';
      case 'LISTA DE ESPERA': return 'Lista de Espera';
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
        .photo-right .photo-img { width: 140px; height: 175px; border: 1px solid #ccc; border-radius: 15px; object-fit: cover; margin-left: auto; display: block; }
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
          .actions-bar { display: none !important; }
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
              ? `<img src="${selMember.photoUrl}" class="photo-img" />`
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

  const printCustomReport = async (typeFilter: 'ALL' | 'ACTIVO' | 'ESPERA' | 'DELEGADO' | 'PENSIONADO') => {
    toast.info('Generando vista previa del reporte...');
    try {
      const r = await fetch('/api/members?limit=3000');
      const d = await r.json();
      const allMembers: Member[] = d.data || [];
      
      let filtered = allMembers;
      let title = 'PADRÓN GENERAL DE MIEMBROS';
      
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'ACTIVO') {
          filtered = allMembers.filter(m => m.memberType === 'AGREMIADO' && m.status === 'ACTIVO');
          title = 'PADRÓN GENERAL DE AGREMIADOS';
        } else if (typeFilter === 'ESPERA') {
          filtered = allMembers.filter(m => m.memberType === 'LISTA DE ESPERA');
          title = 'PADRÓN EN LISTA DE ESPERA';
        } else if (typeFilter === 'DELEGADO') {
          filtered = allMembers.filter(m => m.memberType === 'DELEGADO' && m.status === 'ACTIVO');
          title = 'PADRÓN DE DELEGADOS SINDICALES';
        } else if (typeFilter === 'PENSIONADO') {
          filtered = allMembers.filter(m => getIsPensioner(m));
          title = 'PADRÓN DE JUBILADOS Y PENSIONADOS';
        }
      }

      // Sort by fullName
      filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

      const w = window.open('', '_blank');
      if (!w) { toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); return; }

      const rows = filtered.map((m, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 10px; font-weight: bold; color: #64748b; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px; font-family: monospace; font-weight: bold; text-align: center;">${m.employeeId || 'N/A'}</td>
          <td style="padding: 10px; font-weight: bold; text-transform: uppercase;">${m.fullName || 'N/A'}</td>
          <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #475569;">${m.department || 'N/A'}</td>
          <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #475569;">${m.position || 'N/A'}</td>
          <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #475569; text-align: center;">${getMemberTypeLabel(m.memberType || '')}</td>
          <td style="padding: 10px; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; ${
              m.status === 'ACTIVO' 
                ? 'background-color: #dcfce7; color: #15803d;' 
                : 'background-color: #fee2e2; color: #b91c1c;'
            }">${m.status || 'ACTIVO'}</span>
          </td>
        </tr>
      `).join('');

      w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.4; background: #fff; }
          .report-container { width: 100%; max-width: 1100px; margin: 0 auto; }
          
          .header-container { display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; }
          .logo-box { text-align: center; width: 100%; }
          .logo-img { height: 100px; width: auto; max-width: 100%; display: block; margin: 0 auto; }
          
          .page-title { text-align: center; font-size: 18px; font-weight: 900; margin: 25px 0; text-transform: uppercase; color: #1f2937; letter-spacing: 1px; }
          
          .report-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .report-table th { background: #1e3a8a; color: white; padding: 12px 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; border: 1px solid #1e3a8a; }
          .report-table td { border: 1px solid #e2e8f0; }
          
          .summary-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 25px; margin-top: 20px; margin-bottom: 30px; }
          .summary-item { font-size: 12px; font-weight: bold; color: #475569; }
          .summary-item span { font-size: 14px; font-weight: 900; color: #1e3a8a; margin-left: 5px; }
          
          .signature-section { display: flex; justify-content: space-around; margin-top: 80px; page-break-inside: avoid; }
          .signature-box { width: 250px; text-align: center; border-top: 1px solid #000; padding-top: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          
          @media print { 
            .actions-bar { display: none !important; }
            body { padding: 0; }
            .report-container { max-width: 100%; margin: 0; }
          }
          .actions-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
          .btn { border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-size: 14px; transition: all 0.2s; }
          .btn-print { background: #1e3a8a; color: white; }
          .btn-download { background: #059669; color: white; }
          .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 10px -1px rgba(0,0,0,0.15); }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <script>
          function downloadPDF() {
            const element = document.querySelector('.report-container');
            const opt = {
              margin: 10,
              filename: '${title.replace(/\s+/g, "_")}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
            <div class="logo-box">
              <img src="/logos/logo2.png" class="logo-img">
            </div>
          </div>
  
          <div class="page-title">${title}</div>
  
          <div class="summary-box">
            <div class="summary-item">Total registros filtrados: <span>${filtered.length}</span></div>
            <div class="summary-item">Fecha de generación: <span>${new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'})}</span></div>
          </div>
  
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 50px;">No.</th>
                <th style="width: 100px;">Nómina</th>
                <th>Nombre del Trabajador</th>
                <th>Secretaría / Dirección</th>
                <th>Puesto Oficial</th>
                <th>Tipo de Agremiado</th>
                <th style="width: 100px;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No se encontraron registros para este reporte.</td></tr>'}
            </tbody>
          </table>
  
          <div class="signature-section">
            <div class="signature-box">
              <p style="margin: 0;">Elaboró</p>
              <p style="margin: 40px 0 0 0; color: #64748b;">Firma de Conformidad</p>
            </div>
            <div class="signature-box">
              <p style="margin: 0;">Autorizó</p>
              <p style="margin: 40px 0 0 0; color: #64748b;">Secretaría General</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `);
      w.document.close();
    } catch (e: any) {
      toast.error('Error al generar el reporte: ' + e.message);
    }
  };

  const getAge = (bd: string) => { const t=new Date(),b=new Date(bd); let a=t.getFullYear()-b.getFullYear(); const m=t.getMonth()-b.getMonth(); if(m<0||(m===0&&t.getDate()<b.getDate()))a--; return a; };
  const getBdayText = (bd: string) => {
    const t=new Date(),yr=t.getFullYear(),[,mo,d]=bd.split('-');
    const b=new Date(yr,+mo-1,+d);
    const ds=b.toLocaleDateString('es-ES',{day:'numeric',month:'long'});
    const todayDay = t.getDate();
    const todayMonth = t.getMonth() + 1;
    if (+mo === todayMonth) {
      if (+d === todayDay) return `Hoy 🎉 (${ds})`;
      if (+d === todayDay + 1) return `Mañana (${ds})`;
      if (+d < todayDay) return `Pasó el ${ds}`;
    }
    return `${ds}`;
  };

  const getAgeText = (bd: string) => {
    const today = new Date();
    const [y, mo, d] = bd.split('-');
    const birthYear = parseInt(y, 10);
    const birthDay = parseInt(d, 10);
    const ageThisYear = today.getFullYear() - birthYear;
    if (birthDay < today.getDate()) {
      return `Cumplió ${ageThisYear} años`;
    } else if (birthDay === today.getDate()) {
      return `Cumple ${ageThisYear} años hoy 🎉`;
    } else {
      return `Cumple ${ageThisYear} años`;
    }
  };

  const isTodayBday = (bd: string) => {
    const today = new Date();
    const [, mo, d] = bd.split('-');
    return parseInt(mo, 10) === (today.getMonth() + 1) && parseInt(d, 10) === today.getDate();
  };

  const getMesActualText = () => {
    return new Date().toLocaleDateString('es-ES', { month: 'long' });
  };

  const exportBdaysToCSV = () => {
    if (bdays.length === 0) {
      toast.error('No hay cumpleañeros para exportar');
      return;
    }
    const headers = ['Nómina', 'Nombre Completo', 'Fecha de Nacimiento', 'Día de Cumpleaños', 'Edad', 'Tipo de Agremiado', 'Puesto', 'Departamento', 'Estado'];
    const rows = bdays.map(m => {
      const birthDate = m.birthDate || '';
      const [, mo, d] = birthDate.split('-');
      const ds = birthDate ? new Date(new Date().getFullYear(), +mo - 1, +d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
      const age = birthDate ? new Date().getFullYear() - new Date(birthDate).getFullYear() : '';
      return [
        m.employeeId || '',
        m.fullName || '',
        birthDate,
        ds,
        age,
        m.memberType || '',
        m.position || '',
        m.department || '',
        m.status || ''
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const mes = new Date().toLocaleDateString('es-ES', { month: 'long' });
    link.setAttribute('download', `Cumpleaneros_${mes}_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Lista de cumpleañeros descargada');
  };

  const getAntiguedad = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      let parts = dateStr.split(/[-/]/);
      let year = 0;
      if (parts[0].length === 4) {
        year = parseInt(parts[0]);
      } else if (parts[2]?.length === 4) {
        year = parseInt(parts[2]);
      } else {
        return dateStr;
      }
      const currentYear = new Date().getFullYear();
      const diff = currentYear - year;
      return `${diff} años`;
    } catch {
      return dateStr;
    }
  };

  const printSingleComplaintPDF = (c: any) => {
    if (!selMember) return;
    toast.info('Generando ficha individual de queja...');

    const w = window.open('', '_blank');
    if (!w) { toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); return; }

    const formattedDate = new Date(c.report_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedIngreso = selMember.joinDate || selMember.altaSindicato || 'N/A';

    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ficha de Queja - ${selMember.employeeId}</title>
      <style>
        body { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.3; background: #fff; }
        .ficha-container { width: 100%; max-width: 800px; margin: 0 auto; box-sizing: border-box; }
        
        /* Header section styled exactly like image */
        .header-section { text-align: center; margin-bottom: 25px; padding-bottom: 12px; border-bottom: 2px solid #000; }
        .logo-img-full { height: 100px; width: auto; max-width: 100%; display: block; margin: 0 auto; }
        
        /* Form grid system replicating Excel style precisely */
        .excel-form { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .excel-form td { padding: 6px 10px; font-size: 11px; vertical-align: middle; box-sizing: border-box; }
        .lbl { color: #475569; font-weight: normal; font-size: 11px; text-align: left; width: 15%; text-transform: uppercase; }
        .lbl-noborder { border: none; font-size: 11px; }
        .val-box { border: 1px solid #cbd5e1; font-weight: bold; text-transform: uppercase; font-size: 11.5px; background-color: #fff; height: 26px; }
        .val-box-inline { border: 1px solid #cbd5e1; background-color: #fff; height: 26px; display: flex; align-items: center; padding: 0 10px; font-size: 11.5px; }
        
        /* Large Problem & Solution Blocks next to labels */
        .excel-form-blocks { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px; }
        .excel-form-blocks td { padding: 6px 10px; font-size: 11px; box-sizing: border-box; }
        .lbl-block { color: #475569; font-size: 11px; text-align: left; width: 15%; vertical-align: top; padding-top: 12px; text-transform: uppercase; }
        .val-block-desc { border: 1px solid #cbd5e1; font-weight: bold; font-size: 11.5px; background-color: #fff; min-height: 110px; height: 110px; vertical-align: top; padding: 12px; line-height: 1.5; white-space: pre-wrap; }
        .val-block-sol { border: 1px solid #cbd5e1; font-weight: bold; font-size: 11.5px; background-color: #f8fafc; min-height: 110px; height: 110px; vertical-align: top; padding: 12px; line-height: 1.5; white-space: pre-wrap; }
        
        .signature-section { display: flex; justify-content: space-around; margin-top: 60px; page-break-inside: avoid; }
        .signature-box { width: 220px; text-align: center; border-top: 1px solid #000; padding-top: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #000; }
        
        @media print { 
          .actions-bar { display: none !important; }
          body { padding: 0; }
          .ficha-container { max-width: 100%; margin: 0; }
        }
        .actions-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
        .btn { border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-size: 14px; transition: all 0.2s; }
        .btn-print { background: #1e3a8a; color: white; }
        .btn-download { background: #059669; color: white; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 10px -1px rgba(0,0,0,0.15); }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <script>
        function downloadPDF() {
          const element = document.querySelector('.ficha-container');
          const opt = {
            margin: 10,
            filename: 'Ficha_Queja_${selMember.employeeId}_${c.id.slice(0,6)}.pdf',
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
        <button class="btn btn-print" onclick="window.print()">Imprimir Ficha</button>
      </div>
      <div class="ficha-container">
        <div class="header-section">
          <img src="/logos/logo2.png" class="logo-img-full">
        </div>

        <table class="excel-form">
          <!-- Top row: Date and Status -->
          <tr>
            <td class="lbl-noborder" style="width: 15%; font-weight: bold;">${formattedDate}</td>
            <td class="lbl-noborder" style="width: 30%;"></td>
            <td class="lbl-noborder" style="width: 5%;"></td>
            <td class="lbl" style="width: 20%; text-align: right; font-weight: bold; padding-right: 15px;">STATUS:</td>
            <td class="val-box font-bold" style="width: 30%; text-align: center; background-color: #f8fafc; border: 1px solid #cbd5e1;">${selMember.status || 'ACTIVO'}</td>
          </tr>
          
          <!-- Spacer row -->
          <tr style="height: 15px;">
            <td colspan="5" class="lbl-noborder"></td>
          </tr>

          <!-- Nomina & Fecha de Ingreso -->
          <tr>
            <td class="lbl">nomina</td>
            <td class="val-box" style="text-align: center;">${selMember.employeeId || 'N/A'}</td>
            <td class="lbl-noborder"></td>
            <td class="lbl">FECHA DE INGRESO</td>
            <td class="val-box" style="text-align: center;">${formattedIngreso}</td>
          </tr>

          <!-- Nombre -->
          <tr>
            <td class="lbl">nombre</td>
            <td class="val-box" colspan="4" style="text-align: left; padding-left: 12px;">${selMember.fullName || 'N/A'}</td>
          </tr>

          <!-- Puesto -->
          <tr>
            <td class="lbl">puesto</td>
            <td class="val-box" colspan="4" style="text-align: left; padding-left: 12px;">${selMember.position || 'N/A'}</td>
          </tr>

          <!-- Dirección -->
          <tr>
            <td class="lbl">dirección</td>
            <td class="val-box" colspan="4" style="text-align: left; padding-left: 12px;">${selMember.department || 'N/A'}</td>
          </tr>

          <!-- Secretaria -->
          <tr>
            <td class="lbl">secretaria</td>
            <td class="val-box" colspan="4" style="text-align: left; padding-left: 12px;">${selMember.secretariat || 'N/A'}</td>
          </tr>

          <!-- Antigüedad & Teléfono -->
          <tr>
            <td class="lbl">antigüedad</td>
            <td class="val-box-inline">
              <span style="font-weight: bold;">${getAntiguedad(selMember.joinDate || selMember.altaSindicato).replace(' años', '')}</span>
              <span style="font-size: 9px; margin-left: 15px; color: #64748b; font-weight: normal; text-transform: uppercase;">Años</span>
            </td>
            <td class="lbl-noborder"></td>
            <td class="lbl">teléfono</td>
            <td class="val-box" style="text-align: center;">${selMember.phone || 'N/A'}</td>
          </tr>

          <!-- CURP & RFC -->
          <tr>
            <td class="lbl">CURP</td>
            <td class="val-box" style="text-align: left; padding-left: 12px;">${selMember.curp || 'N/A'}</td>
            <td class="lbl-noborder"></td>
            <td class="lbl">RFC</td>
            <td class="val-box" style="text-align: center;">${selMember.rfc || 'N/A'}</td>
          </tr>

          <!-- Domicilio & CP -->
          <tr>
            <td class="lbl">domicilio</td>
            <td class="val-box" style="text-align: left; padding-left: 12px;">${selMember.address || 'N/A'}</td>
            <td class="lbl-noborder"></td>
            <td class="lbl">CP</td>
            <td class="val-box" style="text-align: center;">${selMember.cp || 'N/A'}</td>
          </tr>

          <!-- Colonia & Ciudad -->
          <tr>
            <td class="lbl">colonia</td>
            <td class="val-box" style="text-align: left; padding-left: 12px;">${selMember.colonia || 'N/A'}</td>
            <td class="lbl-noborder"></td>
            <td class="lbl">ciudad</td>
            <td class="val-box" style="text-align: center;">${selMember.municipio || 'BENITO JUAREZ, N.L.'}</td>
          </tr>
        </table>

        <!-- Problem and Solution Block layout matching the reference precisely -->
        <table class="excel-form-blocks">
          <tr>
            <td class="lbl-block">problema</td>
            <td class="val-block-desc" colspan="4">${c.description || 'Sin descripción detallada.'}</td>
          </tr>
          <tr style="height: 12px;">
            <td colspan="5" class="lbl-noborder"></td>
          </tr>
          <tr>
            <td class="lbl-block">solución</td>
            <td class="val-block-sol" colspan="4">${c.follow_up || 'Pendiente de resolución.'}</td>
          </tr>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <p style="margin: 0;">Firma del Trabajador</p>
            <p style="margin: 45px 0 0 0; color: #94a3b8; font-weight: normal; font-size: 8px;">Nombre y Firma</p>
          </div>
          <div class="signature-box">
            <p style="margin: 0;">Recibió</p>
            <p style="margin: 45px 0 0 0; color: #94a3b8; font-weight: normal; font-size: 8px;">Secretaría de Conflictos / Organización</p>
          </div>
          <div class="signature-box">
            <p style="margin: 0;">Autorizó</p>
            <p style="margin: 45px 0 0 0; color: #94a3b8; font-weight: normal; font-size: 8px;">Secretaría General</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `);
    w.document.close();
  };

  const reportsContent = (
    <div className={onlyShowBirthdays 
      ? "w-full bg-white flex flex-col h-full min-h-0 relative"
      : (inline ? "w-full bg-white border border-gray-200 shadow-xl rounded-[2rem] overflow-hidden flex flex-col-reverse md:flex-row h-[calc(100vh-140px)] min-h-[600px]" : "max-w-[95vw] md:max-w-6xl h-[90vh] md:h-[85vh] rounded-[2rem] border border-gray-200 shadow-2xl p-0 overflow-hidden bg-white flex flex-col-reverse md:flex-row")
    }>
      {/* Sidebar / Bottom Nav on mobile */}
      {!onlyShowBirthdays && (
        <div className="w-full md:w-64 bg-[#1E293B] flex flex-row md:flex-col shrink-0 text-white shadow-2xl z-20">
          <div className="hidden md:flex p-6 flex-col gap-1 border-b border-white/5">
            {inline && (
              onClose ? (
                <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10 hover:text-white mb-2 self-start -ml-2 h-9 w-9">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              ) : (
                <Link href="/">
                  <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10 hover:text-white mb-2 self-start -ml-2 h-9 w-9">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
              )
            )}
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
                ['asistencia','Asistencia',ClipboardCheck],
                ['top20','Top 20',Trophy]
              ] as const).map(([k,l,Icon])=>(
                <button key={k} onClick={()=>{setTab(k as TabType); if(k==='asistencia')loadEvents(); if(k==='top20')loadTop20();}}
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
      )}

      {/* Content */}
      <div className="flex-1 bg-white flex flex-col overflow-hidden relative min-h-0">
        {inline && !onlyShowBirthdays && (
          <div className="p-4 border-b border-gray-100 flex items-center md:hidden shrink-0">
            {onClose ? (
              <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : (
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <span className="font-black text-slate-800 uppercase tracking-wider text-sm ml-2">Menú Principal</span>
          </div>
        )}
        {/* Se removió la tacha redundante interna para usar la tacha global del Dialog de shadcn */}
        <div className={`absolute top-4 right-4 md:top-6 md:right-8 z-10 scale-75 md:scale-100 origin-top-right ${onlyShowBirthdays ? 'mr-12 md:mr-14' : ''}`}>
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
                  {/* Historial de Eventos Asistidos */}
                  <div className="mt-4">
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
              <div className="mb-6 md:mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-100 flex items-center justify-center shadow-inner border border-amber-200 shrink-0">
                    <Gift className="w-6 h-6 md:w-8 md:h-8 text-amber-600"/>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Cumpleañeros del Mes</h2>
                    <p className="text-gray-400 text-sm font-medium italic">Celebrando a nuestros agremiados activos • Mes de {getMesActualText()}</p>
                  </div>
                </div>
                {bdays.length > 0 && (
                  <Button 
                    onClick={exportBdaysToCSV} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
                  >
                    <Download className="w-4 h-4"/>
                    Exportar Excel
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                {bdays.map((m) => {
                  const isToday = isTodayBday(m.birthDate!);
                  return (
                    <div key={m.id} className={`bg-white p-4 rounded-xl shadow-sm border ${isToday ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200' : 'border-gray-100'} flex gap-3 items-center hover:border-blue-200 transition-colors`}>
                      <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {m.photoUrl?<img src={`${m.photoUrl}?t=${new Date().getTime()}`} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-gray-400"><UserIcon className="w-7 h-7"/></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4 className="font-bold text-slate-800 text-sm truncate pr-2">{m.fullName}</h4>
                          <span className={`text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md ${isToday ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-slate-600'}`}>{getBdayText(m.birthDate!)}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mb-1">Nómina: {m.employeeId} • {m.memberType}</p>
                        <p className={`text-xs font-bold ${isToday ? 'text-amber-600' : 'text-blue-600'}`}>{getAgeText(m.birthDate!)}</p>
                      </div>
                    </div>
                  );
                })}
                {bdays.length===0 && <div className="col-span-2 text-center py-10 text-gray-400">No hay cumpleañeros en este mes.</div>}
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
                    <div className="w-full md:flex-1 flex flex-col gap-1">
                      {editingEventId === ev.id ? (
                        <div className="flex items-center gap-2 max-w-md w-full" onClick={e => e.stopPropagation()}>
                          <Input 
                            value={editingEventName} 
                            onChange={e => setEditingEventName(e.target.value)} 
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveRename(ev.id);
                              if (e.key === 'Escape') setEditingEventId(null);
                            }}
                            className="h-9 py-1 text-sm border-blue-200 focus-visible:ring-blue-500 font-semibold"
                            autoFocus
                          />
                          <Button 
                            size="sm" 
                            className="h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 rounded-lg" 
                            onClick={() => saveRename(ev.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 w-9 p-0 text-gray-500 hover:bg-gray-100 shrink-0 rounded-lg" 
                            onClick={() => setEditingEventId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="cursor-pointer group/title flex items-center gap-2" onClick={()=>loadAttendees(ev)}>
                          <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-blue-600 transition-colors">{ev.name}</h4>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingEventId(ev.id); 
                              setEditingEventName(ev.name); 
                            }} 
                            className="opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity p-1"
                            title="Editar nombre"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] md:text-xs text-gray-400">{ev.date} • {ev.attendee_count} asistentes</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      <Button size="sm" variant="outline" onClick={()=>loadAttendees(ev)} className="flex-1 md:flex-none text-xs gap-1 border-blue-100 text-blue-600 hover:bg-blue-50"><Eye className="w-3.5 h-3.5"/>Lista</Button>
                      <Button size="sm" variant="outline" onClick={()=>{setCaptureEvent(ev);setCaptureList([]);setCaptureCount(ev.attendee_count);}} className="flex-1 md:flex-none text-xs gap-1"><Users className="w-3.5 h-3.5"/>Capturar</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteEvent(ev.id)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg shrink-0" title="Eliminar evento"><Trash2 className="w-4 h-4"/></Button>
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

          {tab === 'top20' && (
            <div className="p-4 md:p-10 flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Top 20 Asistencias</h2>
                  <p className="text-gray-400 text-xs md:text-sm font-medium">Agremiados y Lista de Espera con mayor asistencia registrada</p>
                </div>
                
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm text-xs font-bold uppercase">
                    <button
                      onClick={() => { setTop20SubTab('general'); setTop20TypeFilter('ALL'); }}
                      className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        top20SubTab === 'general'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      General
                    </button>
                    <button
                      onClick={() => { setTop20SubTab('espera'); setTop20TypeFilter('ALL'); }}
                      className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        top20SubTab === 'espera'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Lista de Espera
                    </button>
                  </div>

                  <Button
                    onClick={downloadTop20CSV}
                    disabled={top20Data.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-100 flex items-center gap-2 text-xs"
                  >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {top20Loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-blue-600 gap-3">
                  <div className="w-10 h-10 border-4 border-t-blue-600 border-blue-100 rounded-full animate-spin"></div>
                  <span className="font-bold uppercase tracking-wider text-xs">Cargando estadísticas...</span>
                </div>
              ) : top20Data.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">No hay registros de asistencia en el sistema.</div>
              ) : (
                <div className="space-y-10 animate-in fade-in zoom-in duration-300">
                  
                  {/* CHART CARD */}
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-black text-blue-900 uppercase text-sm tracking-wider mb-6 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Gráfica de Rendimiento (Top 20)
                    </h3>
                    
                    <div className="space-y-4">
                      {chartData.map((item, idx) => {
                        const maxCount = chartData[0]?.count || 1;
                        const pct = Math.max(8, (item.count / maxCount) * 100);
                        
                        // Top 3 distinct ranking designs
                        const rankColors = [
                          'bg-amber-400 text-amber-950 ring-4 ring-amber-100', // Gold
                          'bg-slate-300 text-slate-900 ring-4 ring-slate-100', // Silver
                          'bg-amber-600 text-amber-50 ring-4 ring-amber-100',  // Bronze
                        ];
                        const rankBadge = idx < 3 
                          ? rankColors[idx]
                          : 'bg-slate-100 text-slate-600';

                        return (
                          <div 
                            key={item.employeeId} 
                            onClick={() => { loadAtt(item.employeeId); setTab('busqueda'); }}
                            className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 group p-2 rounded-2xl hover:bg-slate-50/80 cursor-pointer hover:shadow-sm border border-transparent hover:border-blue-100 transition-all duration-200"
                            title="Haz clic para ver reporte de asistencia"
                          >
                            {/* Member Meta */}
                            <div className="flex items-center gap-3 w-full md:w-80 shrink-0">
                              <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${rankBadge}`}>
                                #{idx + 1}
                              </span>
                              
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                {item.photoUrl ? (
                                  <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-100">
                                    {item.fullName.charAt(0)}
                                  </div>
                                )}
                              </div>
                              
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-sm truncate uppercase leading-tight">{item.fullName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Nómina: {item.employeeId}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                    item.memberType === 'LISTA DE ESPERA' ? 'bg-amber-100 text-amber-800' : 
                                    item.memberType === 'DELEGADO' ? 'bg-purple-100 text-purple-800' :
                                    item.memberType === 'SECRETARIO GENERAL' ? 'bg-indigo-100 text-indigo-800' :
                                    'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {getMemberTypeLabel(item.memberType)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Bar proportion */}
                            <div className="flex-1 flex items-center gap-3">
                              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/50">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000 ease-out shadow-sm"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-28 text-right font-black text-blue-900 text-sm shrink-0 whitespace-nowrap">
                                {item.count} {item.count === 1 ? 'asistencia' : 'asistencias'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {chartData.length === 0 && (
                        <div className="text-center py-10 text-gray-400 italic">No hay agremiados o lista de espera con asistencia.</div>
                      )}
                    </div>
                  </div>
                  
                  {/* ALL ATTENDEES TABLE */}
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <h3 className="font-black text-blue-900 uppercase text-sm tracking-wider flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Listado General de Asistentes
                      </h3>
                      
                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Search input */}
                        <div className="relative flex-1 sm:w-64">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Buscar por nombre o nómina..."
                            value={top20Search}
                            onChange={(e) => setTop20Search(e.target.value)}
                            className="pl-10 text-xs font-semibold uppercase bg-gray-50 border-gray-200 focus:bg-white rounded-xl h-9"
                          />
                        </div>
                        
                        {/* Filter dropdown */}
                        {top20SubTab === 'general' && (
                          <select
                            value={top20TypeFilter}
                            onChange={(e) => setTop20TypeFilter(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-slate-800 rounded-xl px-3 py-1 text-xs font-bold uppercase h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="ALL">Todos los roles</option>
                            <option value="ACTIVO">Activos</option>
                            <option value="PENSIONADO">Pensionados</option>
                            <option value="DELEGADO">Delegados</option>
                            <option value="BAJA">Bajas</option>
                          </select>
                        )}
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-gray-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="py-3 px-4 text-center w-16">Pos.</th>
                            <th className="py-3 px-4 w-24">Nómina</th>
                            <th className="py-3 px-4">Nombre Completo</th>
                            <th className="py-3 px-4 w-32">Tipo Miembro</th>
                            <th className="py-3 px-4 w-44">Secretaría / Dirección</th>
                            <th className="py-3 px-4 w-28 text-center">Estatus</th>
                            <th className="py-3 px-4 w-32 text-center">Asistencias</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-xs font-medium text-slate-700">
                          {filteredAllAttendees.map((item, idx) => (
                            <tr 
                              key={item.employeeId} 
                              onClick={() => { loadAtt(item.employeeId); setTab('busqueda'); }}
                              className="hover:bg-blue-50/40 cursor-pointer transition-colors uppercase"
                              title="Haz clic para ver reporte de asistencia"
                            >
                              <td className="py-3 px-4 text-center font-bold text-slate-400">#{idx + 1}</td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.employeeId}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{item.fullName}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider ${
                                  item.memberType === 'AGREMIADO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  item.memberType === 'DELEGADO' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                  'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {getMemberTypeLabel(item.memberType)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 truncate max-w-[170px]">{item.department}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 
                                  item.status === 'INCAPACITADO' ? 'bg-amber-100 text-amber-800' :
                                  item.status === 'N/A' ? 'bg-orange-100 text-orange-800' :
                                  getIsPensioner(item) ? 'bg-blue-100 text-blue-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {item.status === 'N/A' ? 'N/A' : (getIsPensioner(item) ? 'PENSIONADO' : item.status)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-black text-blue-900 text-sm">{item.count}</td>
                            </tr>
                          ))}
                          {filteredAllAttendees.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-gray-400 italic">
                                No se encontraron asistentes con los filtros aplicados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
        reportsContent
      ) : (
        <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
          <DialogContent showCloseButton={false} className="max-w-[95vw] md:max-w-6xl h-[90vh] md:h-[85vh] rounded-[2rem] border border-gray-200 shadow-2xl p-0 overflow-hidden bg-white flex flex-col-reverse md:flex-row">
            {reportsContent}
          </DialogContent>
        </Dialog>
      )}

      {showQR && (
        <QRScanner onScan={handleQRResult} onClose={() => setShowQR(false)} />
      )}

    </>
  );
}
