'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  UserMinus, 
  Award, 
  Heart, 
  FileWarning, 
  Printer, 
  Loader2, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Download, 
  Filter 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Member } from '@/types/member';
import Link from 'next/link';

export default function ReportesAgremiadosPage() {
  // Caches for database records
  const [membersCache, setMembersCache] = useState<Member[] | null>(null);
  const [complaintsCache, setComplaintsCache] = useState<any[] | null>(null);

  // Configuration Modal States
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  // Filters for member reports
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Filters for complaints reports
  const [complaintStatus, setComplaintStatus] = useState<'ALL' | 'PENDIENTE' | 'RESUELTO'>('ALL');
  const [complaintDateStart, setComplaintDateStart] = useState<string>('');
  const [complaintDateEnd, setComplaintDateEnd] = useState<string>('');

  // Headers for CSV exports
  const memberHeaders = [
    { key: 'employeeId', label: 'Nómina' },
    { key: 'fullName', label: 'Nombre Completo' },
    { key: 'curp', label: 'CURP' },
    { key: 'rfc', label: 'RFC' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'status', label: 'Estatus' },
    { key: 'memberType', label: 'Tipo de Miembro' },
    { key: 'department', label: 'Departamento / Dirección' },
    { key: 'position', label: 'Puesto Oficial' },
    { key: 'joinDate', label: 'Fecha Ingreso' }
  ];

  const complaintHeaders = [
    { key: 'employee_id', label: 'Nómina' },
    { key: 'member_name', label: 'Nombre Trabajador' },
    { key: 'member_department', label: 'Departamento / Dirección' },
    { key: 'report_date', label: 'Fecha Levantamiento' },
    { key: 'description', label: 'Descripción' },
    { key: 'follow_up', label: 'Seguimiento / Estatus' }
  ];

  const getUniqueDepartments = () => {
    if (!membersCache) return [];
    const depts = membersCache.map(m => m.department?.trim()).filter(Boolean);
    return Array.from(new Set(depts)).sort() as string[];
  };

  const getFilteredMembersCount = (dept: string) => {
    if (!membersCache) return 0;
    let base = membersCache;
    if (selectedReport && selectedReport.id !== 'ALL') {
      base = base.filter(m => m.memberType === selectedReport.id);
    }
    if (dept !== 'ALL') {
      base = base.filter(m => m.department === dept);
    }
    return base.length;
  };

  const getFilteredComplaintsCount = (status: 'ALL' | 'PENDIENTE' | 'RESUELTO') => {
    if (!complaintsCache) return 0;
    let base = complaintsCache;
    
    // Date filter
    if (complaintDateStart) {
      base = base.filter(c => c.report_date >= complaintDateStart);
    }
    if (complaintDateEnd) {
      base = base.filter(c => c.report_date <= complaintDateEnd);
    }
    
    // Status filter
    if (status === 'PENDIENTE') {
      base = base.filter(c => !c.follow_up || c.follow_up.trim() === '' || c.follow_up.toUpperCase() === 'PENDIENTE');
    } else if (status === 'RESUELTO') {
      base = base.filter(c => c.follow_up && c.follow_up.trim() !== '' && c.follow_up.toUpperCase() !== 'PENDIENTE');
    }
    return base.length;
  };

  const openConfigModal = async (reportId: string) => {
    const report = reportsList.find(r => r.id === reportId);
    if (!report) return;

    setSelectedReport(report);
    setExportFormat('pdf');
    setSelectedDept('ALL');
    setComplaintStatus('ALL');
    setComplaintDateStart('');
    setComplaintDateEnd('');
    setIsConfigModalOpen(true);
    setIsLoadingData(true);

    try {
      if (reportId === 'complaints') {
        if (!complaintsCache) {
          const r = await fetch('/api/complaints');
          const d = await r.json();
          setComplaintsCache(d.complaints || []);
        }
      } else {
        if (!membersCache) {
          const r = await fetch('/api/members?limit=3000');
          const d = await r.json();
          setMembersCache(d.data || []);
        }
      }
    } catch (e: any) {
      toast.error('Error al cargar la información: ' + e.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const downloadCSV = (data: any[], headers: { key: string; label: string }[], filename: string) => {
    // 1. Create CSV header row
    const headerRow = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
    
    // 2. Create CSV data rows
    const dataRows = data.map(row => {
      return headers.map(h => {
        const val = row[h.key] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    // 3. Combine header and data rows with UTF-8 BOM
    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n');
    
    // 4. Create a Blob and download it
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Reporte descargado en formato CSV/Excel');
  };

  const generatePDFForMembers = (filtered: Member[], reportTitle: string) => {
    const w = window.open('', '_blank');
    if (!w) { 
      toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); 
      return; 
    }

    const rows = filtered.map((m, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 10px; font-weight: bold; color: #64748b; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; font-family: monospace; font-weight: bold; text-align: center;">${m.employeeId || 'N/A'}</td>
        <td style="padding: 10px; font-weight: bold; text-transform: uppercase;">${m.fullName || 'N/A'}</td>
        <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #475569;">${m.department || 'N/A'}</td>
        <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #475569;">${m.position || 'N/A'}</td>
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
      <title>${reportTitle}</title>
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
          .actions-bar { display: none; }
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
            filename: '${reportTitle.replace(/\s+/g, "_")}.pdf',
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

        <div class="page-title">${reportTitle}</div>

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
              <th style="width: 100px;">Estatus</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No se encontraron registros para este reporte.</td></tr>'}
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
    toast.success('Reporte generado correctamente');
  };

  const generatePDFForComplaints = (filtered: any[], reportTitle: string) => {
    const w = window.open('', '_blank');
    if (!w) { 
      toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); 
      return; 
    }

    const rows = filtered.map((c, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top;">
        <td style="padding: 10px; font-weight: bold; color: #64748b; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; font-family: monospace; font-weight: bold; text-align: center;">${c.employee_id || 'N/A'}</td>
        <td style="padding: 10px; font-weight: bold; text-transform: uppercase;">${c.member_name || 'N/A'}</td>
        <td style="padding: 10px; text-transform: uppercase; font-size: 9px; color: #475569;">${c.member_department || 'N/A'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #1e3a8a;">
          ${new Date(c.report_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </td>
        <td style="padding: 10px; font-size: 9px; white-space: pre-wrap; max-width: 250px; line-height: 1.3;">${c.description || 'N/A'}</td>
        <td style="padding: 10px; font-size: 9px; white-space: pre-wrap; max-width: 200px; color: #047857; font-weight: 600; line-height: 1.3; background-color: #f0fdf4;">${c.follow_up || 'PENDIENTE'}</td>
      </tr>
    `).join('');

    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportTitle}</title>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.4; background: #fff; }
        .report-container { width: 100%; max-width: 1200px; margin: 0 auto; }
        
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
          .actions-bar { display: none; }
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
            filename: '${reportTitle.replace(/\s+/g, "_")}.pdf',
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

        <div class="page-title">${reportTitle}</div>

        <div class="summary-box">
          <div class="summary-item">Total quejas registradas: <span>${filtered.length}</span></div>
          <div class="summary-item">Fecha de generación: <span>${new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'})}</span></div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 40px;">No.</th>
              <th style="width: 80px;">Nómina</th>
              <th style="width: 180px;">Nombre del Trabajador</th>
              <th style="width: 150px;">Área / Departamento</th>
              <th style="width: 90px;">Fecha Reporte</th>
              <th>Descripción del Reporte</th>
              <th style="width: 200px;">Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No se encontraron registros de quejas en el sistema.</td></tr>'}
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
    toast.success('Concentrado de quejas generado');
  };

  const handleGenerateReport = () => {
    if (!selectedReport) return;

    if (selectedReport.id === 'complaints') {
      if (!complaintsCache) return;
      
      let base = [...complaintsCache];
      
      // Date filter
      if (complaintDateStart) {
        base = base.filter(c => c.report_date >= complaintDateStart);
      }
      if (complaintDateEnd) {
        base = base.filter(c => c.report_date <= complaintDateEnd);
      }
      
      // Status filter
      if (complaintStatus === 'PENDIENTE') {
        base = base.filter(c => !c.follow_up || c.follow_up.trim() === '' || c.follow_up.toUpperCase() === 'PENDIENTE');
      } else if (complaintStatus === 'RESUELTO') {
        base = base.filter(c => c.follow_up && c.follow_up.trim() !== '' && c.follow_up.toUpperCase() !== 'PENDIENTE');
      }
      
      base.sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));

      if (base.length === 0) {
        toast.warning('No se encontraron registros con los filtros seleccionados.');
        return;
      }

      if (exportFormat === 'pdf') {
        let title = 'CONCENTRADO DE QUEJAS Y REPORTES DE AGREMIADOS';
        if (complaintStatus === 'PENDIENTE') title += ' - SOLO PENDIENTES';
        else if (complaintStatus === 'RESUELTO') title += ' - SOLO ATENDIDAS';
        generatePDFForComplaints(base, title);
      } else {
        const statusName = complaintStatus === 'ALL' ? 'Todas' : complaintStatus === 'PENDIENTE' ? 'Pendientes' : 'Resueltas';
        const dateRange = (complaintDateStart && complaintDateEnd) ? `_${complaintDateStart}_a_${complaintDateEnd}` : '';
        const filename = `Reporte_Quejas_${statusName}${dateRange}.csv`;
        downloadCSV(base, complaintHeaders, filename);
      }
    } else {
      if (!membersCache) return;
      
      let base = [...membersCache];
      
      // Type filter
      if (selectedReport.id !== 'ALL') {
        base = base.filter(m => m.memberType === selectedReport.id);
      }
      
      // Department filter
      if (selectedDept !== 'ALL') {
        base = base.filter(m => m.department === selectedDept);
      }

      base.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

      if (base.length === 0) {
        toast.warning('No se encontraron registros con los filtros seleccionados.');
        return;
      }

      const typeTitle = selectedReport.id === 'ALL' ? 'PADRÓN GENERAL DE MIEMBROS' : selectedReport.title.toUpperCase();
      const deptTitle = selectedDept === 'ALL' ? '' : ` - ${selectedDept.toUpperCase()}`;
      const title = `${typeTitle}${deptTitle}`;

      if (exportFormat === 'pdf') {
        generatePDFForMembers(base, title);
      } else {
        const typeName = selectedReport.id === 'ALL' ? 'General' : selectedReport.title.replace(/\s+/g, '_');
        const deptName = selectedDept === 'ALL' ? 'Todos' : selectedDept.replace(/\s+/g, '_');
        const filename = `Padron_${typeName}_${deptName}.csv`;
        downloadCSV(base, memberHeaders, filename);
      }
    }

    setIsConfigModalOpen(false);
  };

  const reportsList = [
    {
      id: 'ALL',
      title: 'Padrón Completo',
      description: 'Reporte general de todos los miembros registrados en el sistema.',
      icon: Users,
      color: 'bg-blue-600 shadow-blue-500/20 hover:border-blue-500',
      accentClass: 'via-blue-400',
      action: () => openConfigModal('ALL')
    },
    {
      id: 'ACTIVO',
      title: 'Agremiados Activos',
      description: 'Padrón de miembros que actualmente se encuentran activos.',
      icon: UserCheck,
      color: 'bg-emerald-600 shadow-emerald-500/20 hover:border-emerald-500',
      accentClass: 'via-emerald-400',
      action: () => openConfigModal('ACTIVO')
    },
    {
      id: 'ESPERA',
      title: 'Lista de Espera',
      description: 'Listado de miembros que se encuentran en estatus de espera.',
      icon: UserMinus,
      color: 'bg-amber-600 shadow-amber-500/20 hover:border-amber-500',
      accentClass: 'via-amber-400',
      action: () => openConfigModal('ESPERA')
    },
    {
      id: 'DELEGADO',
      title: 'Delegados Sindicales',
      description: 'Listado de miembros que actúan como delegados oficiales.',
      icon: Award,
      color: 'bg-purple-600 shadow-purple-500/20 hover:border-purple-500',
      accentClass: 'via-purple-400',
      action: () => openConfigModal('DELEGADO')
    },
    {
      id: 'PENSIONADO',
      title: 'Jubilados y Pensionados',
      description: 'Listado de miembros jubilados y pensionados del sindicato.',
      icon: Heart,
      color: 'bg-pink-600 shadow-pink-500/20 hover:border-pink-500',
      accentClass: 'via-pink-400',
      action: () => openConfigModal('PENSIONADO')
    },
    {
      id: 'complaints',
      title: 'Quejas de Agremiados',
      description: 'Concentrado e historial de quejas y reportes de los miembros.',
      icon: FileWarning,
      color: 'bg-rose-600 shadow-rose-500/20 hover:border-rose-500',
      accentClass: 'via-rose-400',
      action: () => openConfigModal('complaints')
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8 pb-12">
      <div className="w-full max-w-6xl bg-white border border-gray-100 shadow-xl rounded-[2rem] overflow-hidden flex flex-col h-[calc(100vh-100px)] min-h-[600px]">
        {/* Header */}
        <div className="px-5 py-5 md:px-10 md:py-8 bg-white border-b border-gray-100 flex items-center gap-4 shrink-0">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-black text-blue-900 uppercase tracking-tighter flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600 shrink-0" />
              Reportes de Agremiados
            </h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 italic">
              Generación de padrones generales y concentrados de quejas
            </p>
          </div>
        </div>

        {/* Content / Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50/30 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportsList.map((item) => {
              const IconComponent = item.icon;
              const isProcessing = selectedReport?.id === item.id && isLoadingData;
              
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  disabled={isLoadingData}
                  className="w-full text-left bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${item.accentClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                  
                  <div className="w-full flex flex-col h-full justify-between pr-4">
                    <div>
                      {/* Icon wrapper */}
                      <div className={`${item.color.split(' ')[0]} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all mb-5`}>
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <IconComponent className="w-6 h-6" />
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                        {item.title}
                        {isProcessing && <span className="text-[10px] text-blue-600 font-bold normal-case animate-pulse">(Cargando...)</span>}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Micro-interaction action arrow */}
                  <div className="absolute bottom-6 right-6 text-slate-300 opacity-40 group-hover:opacity-100 group-hover:text-slate-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Export & Filter Configuration Dialog */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-md md:max-w-lg rounded-[2.5rem] border-none shadow-2xl p-6 md:p-8 bg-white overflow-hidden flex flex-col gap-6">
          {selectedReport && (
            <>
              {/* Modal Header */}
              <div className="flex items-center gap-4">
                <div className={`${selectedReport.color.split(' ')[0]} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                  {React.createElement(selectedReport.icon, { className: "w-6 h-6" })}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">
                    Configurar Reporte
                  </h3>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-0.5">
                    {selectedReport.title}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                {isLoadingData ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">
                      Cargando base de datos...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Filters Section */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100 pb-1 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" /> 1. Filtros Disponibles
                      </h4>

                      {selectedReport.id === 'complaints' ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] md:text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider">
                              Estatus de la Queja
                            </label>
                            <select
                              value={complaintStatus}
                              onChange={(e) => setComplaintStatus(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                            >
                              <option value="ALL">Todas las quejas ({getFilteredComplaintsCount('ALL')})</option>
                              <option value="PENDIENTE">Solo Pendientes ({getFilteredComplaintsCount('PENDIENTE')})</option>
                              <option value="RESUELTO">Solo Atendidas / Resueltas ({getFilteredComplaintsCount('RESUELTO')})</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] md:text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider">
                                Fecha Inicio
                              </label>
                              <input
                                type="date"
                                value={complaintDateStart}
                                onChange={(e) => setComplaintDateStart(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] md:text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider">
                                Fecha Fin
                              </label>
                              <input
                                type="date"
                                value={complaintDateEnd}
                                onChange={(e) => setComplaintDateEnd(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] md:text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider">
                            Secretaría / Dirección
                          </label>
                          <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                          >
                            <option value="ALL">Todas las Secretarías ({getFilteredMembersCount('ALL')})</option>
                            {getUniqueDepartments().map((dept) => (
                              <option key={dept} value={dept}>
                                {dept} ({getFilteredMembersCount(dept)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Format Selection Section */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100 pb-1 flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-slate-400" /> 2. Formato de Exportación
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        {/* PDF Option */}
                        <button
                          type="button"
                          onClick={() => setExportFormat('pdf')}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 gap-2 ${
                            exportFormat === 'pdf'
                              ? 'border-blue-600 bg-blue-50/30 text-blue-700 font-black'
                              : 'border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200 font-bold'
                          }`}
                        >
                          <Printer className="w-6 h-6 shrink-0" />
                          <span className="text-xs uppercase tracking-wider">PDF (Imprimir)</span>
                        </button>

                        {/* CSV/Excel Option */}
                        <button
                          type="button"
                          onClick={() => setExportFormat('csv')}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all duration-200 gap-2 ${
                            exportFormat === 'csv'
                              ? 'border-emerald-600 bg-emerald-50/30 text-emerald-700 font-black'
                              : 'border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200 font-bold'
                          }`}
                        >
                          <FileSpreadsheet className="w-6 h-6 shrink-0" />
                          <span className="text-xs uppercase tracking-wider">Excel (CSV)</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 justify-end shrink-0 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="rounded-2xl py-4 font-bold text-xs uppercase tracking-wide border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  disabled={isLoadingData}
                  className={`rounded-2xl py-4 font-black text-xs uppercase tracking-wider text-white transition-all flex items-center gap-1.5 px-6 ${
                    exportFormat === 'pdf'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  {exportFormat === 'pdf' ? (
                    <>
                      <Printer className="w-4 h-4" />
                      Imprimir PDF
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Descargar Excel
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
