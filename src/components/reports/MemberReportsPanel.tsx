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
  Filter,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Member } from '@/types/member';
import Link from 'next/link';

export function MemberReportsPanel({ inline = false, onClose = () => {} }: { inline?: boolean; onClose?: () => void }) {
  // Caches for database records
  const [membersCache, setMembersCache] = useState<Member[] | null>(null);
  const [complaintsCache, setComplaintsCache] = useState<any[] | null>(null);

  // Selected Report (null = show cards grid, not-null = show intelligent list view)
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Filters for complaints reports
  const [complaintStatus, setComplaintStatus] = useState<'ALL' | 'PENDIENTE' | 'RESUELTO'>('ALL');
  const [complaintDateStart, setComplaintDateStart] = useState<string>('');
  const [complaintDateEnd, setComplaintDateEnd] = useState<string>('');

  // Selection state (Set of selected item IDs)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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
    let base = membersCache;
    if (selectedReport) {
      if (selectedReport.id === 'ACTIVO') {
        base = base.filter(m => m.memberType === 'AGREMIADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'DELEGADO') {
        base = base.filter(m => m.memberType === 'DELEGADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'ESPERA') {
        base = base.filter(m => m.status === 'LISTA DE ESPERA');
      } else if (selectedReport.id === 'PENSIONADO') {
        base = base.filter(m => m.status === 'PENSIONADO');
      }
    }
    const depts = base.map(m => m.department?.trim()).filter(Boolean);
    return Array.from(new Set(depts)).sort() as string[];
  };

  const getFilteredMembersCount = (dept: string) => {
    if (!membersCache) return 0;
    let base = membersCache;
    if (selectedReport) {
      if (selectedReport.id === 'ACTIVO') {
        base = base.filter(m => m.memberType === 'AGREMIADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'DELEGADO') {
        base = base.filter(m => m.memberType === 'DELEGADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'ESPERA') {
        base = base.filter(m => m.status === 'LISTA DE ESPERA');
      } else if (selectedReport.id === 'PENSIONADO') {
        base = base.filter(m => m.status === 'PENSIONADO');
      }
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

  const openReportList = async (reportId: string) => {
    const report = reportsList.find(r => r.id === reportId);
    if (!report) return;

    setSelectedReport(report);
    setSearchQuery('');
    setSelectedDept('ALL');
    setComplaintStatus('ALL');
    setComplaintDateStart('');
    setComplaintDateEnd('');
    setCurrentPage(1);
    setIsLoadingData(true);

    try {
      let fetchedData: any[] = [];
      if (reportId === 'complaints') {
        let data = complaintsCache;
        if (!data) {
          const r = await fetch('/api/complaints');
          const d = await r.json();
          data = d.complaints || [];
          setComplaintsCache(data);
        }
        fetchedData = data || [];
      } else {
        let data = membersCache;
        if (!data) {
          const r = await fetch('/api/members?limit=3000');
          const d = await r.json();
          data = d.data || [];
          setMembersCache(data);
        }
        
        // Filter base members by type and status
        if (reportId === 'ACTIVO') {
          fetchedData = (data || []).filter((m: any) => m.memberType === 'AGREMIADO' && m.status === 'ACTIVO');
        } else if (reportId === 'DELEGADO') {
          fetchedData = (data || []).filter((m: any) => m.memberType === 'DELEGADO' && m.status === 'ACTIVO');
        } else if (reportId === 'ESPERA') {
          fetchedData = (data || []).filter((m: any) => m.status === 'LISTA DE ESPERA');
        } else if (reportId === 'PENSIONADO') {
          fetchedData = (data || []).filter((m: any) => m.status === 'PENSIONADO');
        } else {
          fetchedData = data || [];
        }
      }

      // Initialize selection with all matching item IDs
      const ids = fetchedData.map((item: any) => item.id);
      setSelectedIds(new Set(ids));
    } catch (e: any) {
      toast.error('Error al cargar la información: ' + e.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Get filtered items based on current toolbar filters
  const getFilteredItems = () => {
    if (!selectedReport) return [];
    
    if (selectedReport.id === 'complaints') {
      if (!complaintsCache) return [];
      let base = [...complaintsCache];
      
      // Search query (Nómina or Trabajador)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        base = base.filter(c => 
          (c.employee_id || '').toLowerCase().includes(query) || 
          (c.member_name || '').toLowerCase().includes(query)
        );
      }

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
      
      return base;
    } else {
      if (!membersCache) return [];
      let base = [...membersCache];
      
      // Base type and status filter
      if (selectedReport.id === 'ACTIVO') {
        base = base.filter(m => m.memberType === 'AGREMIADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'DELEGADO') {
        base = base.filter(m => m.memberType === 'DELEGADO' && m.status === 'ACTIVO');
      } else if (selectedReport.id === 'ESPERA') {
        base = base.filter(m => m.status === 'LISTA DE ESPERA');
      } else if (selectedReport.id === 'PENSIONADO') {
        base = base.filter(m => m.status === 'PENSIONADO');
      }

      // Search query (Nómina or Nombre)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        base = base.filter(m => 
          (m.employeeId || '').toLowerCase().includes(query) || 
          (m.fullName || '').toLowerCase().includes(query)
        );
      }

      // Department filter
      if (selectedDept !== 'ALL') {
        base = base.filter(m => m.department === selectedDept);
      }
      
      return base;
    }
  };

  // Sort filtered items
  const getSortedFilteredItems = () => {
    const items = getFilteredItems();
    if (selectedReport?.id === 'complaints') {
      return items.sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));
    } else {
      return items.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }
  };

  // Row selection helpers
  const isRowSelected = (id: string) => selectedIds.has(id);

  const handleRowSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const isAllFilteredSelected = (filteredItems: any[]) => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every(item => selectedIds.has(item.id));
  };

  const toggleSelectAllFiltered = (filteredItems: any[]) => {
    const next = new Set(selectedIds);
    const allSelected = isAllFilteredSelected(filteredItems);
    
    if (allSelected) {
      filteredItems.forEach(item => next.delete(item.id));
    } else {
      filteredItems.forEach(item => next.add(item.id));
    }
    setSelectedIds(next);
  };

  const getSelectedFilteredCount = (filteredItems: any[]) => {
    return filteredItems.filter(item => selectedIds.has(item.id)).length;
  };

  const downloadCSV = (data: any[], headers: { key: string; label: string }[], filename: string) => {
    const headerRow = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
    
    const dataRows = data.map(row => {
      return headers.map(h => {
        const val = row[h.key] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Reporte descargado en formato Excel (CSV)');
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
    toast.success('Reporte de PDF generado');
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
    toast.success('Reporte de quejas generado');
  };

  const handleGeneratePDF = (items: any[]) => {
    if (items.length === 0) {
      toast.warning('Por favor selecciona al menos un registro para imprimir.');
      return;
    }
    
    const typeTitle = selectedReport.id === 'ALL' ? 'PADRÓN GENERAL DE MIEMBROS' : selectedReport.title.toUpperCase();
    const deptTitle = selectedDept === 'ALL' ? '' : ` - ${selectedDept.toUpperCase()}`;
    const title = `${typeTitle}${deptTitle} (SELECCIÓN: ${items.length} REG.)`;

    if (selectedReport.id === 'complaints') {
      generatePDFForComplaints(items, title);
    } else {
      generatePDFForMembers(items, title);
    }
  };

  const handleGenerateExcel = (items: any[]) => {
    if (items.length === 0) {
      toast.warning('Por favor selecciona al menos un registro para exportar.');
      return;
    }

    if (selectedReport.id === 'complaints') {
      const statusName = complaintStatus === 'ALL' ? 'Todas' : complaintStatus === 'PENDIENTE' ? 'Pendientes' : 'Resueltas';
      const dateRange = (complaintDateStart && complaintDateEnd) ? `_${complaintDateStart}_a_${complaintDateEnd}` : '';
      const filename = `Reporte_Quejas_${statusName}${dateRange}_seleccion.csv`;
      downloadCSV(items, complaintHeaders, filename);
    } else {
      const typeName = selectedReport.id === 'ALL' ? 'General' : selectedReport.title.replace(/\s+/g, '_');
      const deptName = selectedDept === 'ALL' ? 'Todos' : selectedDept.replace(/\s+/g, '_');
      const filename = `Padron_${typeName}_${deptName}_seleccion.csv`;
      downloadCSV(items, memberHeaders, filename);
    }
  };

  const reportsList = [
    {
      id: 'ALL',
      title: 'Padrón Completo',
      description: 'Reporte general de todos los miembros registrados en el sistema.',
      icon: Users,
      color: 'bg-blue-600 shadow-blue-500/20 hover:border-blue-500',
      accentClass: 'via-blue-400',
      action: () => openReportList('ALL')
    },
    {
      id: 'ACTIVO',
      title: 'Agremiados Activos',
      description: 'Padrón de miembros que actualmente se encuentran activos.',
      icon: UserCheck,
      color: 'bg-emerald-600 shadow-emerald-500/20 hover:border-emerald-500',
      accentClass: 'via-emerald-400',
      action: () => openReportList('ACTIVO')
    },
    {
      id: 'ESPERA',
      title: 'Lista de Espera',
      description: 'Listado de miembros que se encuentran en estatus de espera.',
      icon: UserMinus,
      color: 'bg-amber-600 shadow-amber-500/20 hover:border-amber-500',
      accentClass: 'via-amber-400',
      action: () => openReportList('ESPERA')
    },
    {
      id: 'DELEGADO',
      title: 'Delegados Sindicales',
      description: 'Listado de miembros que actúan como delegados oficiales.',
      icon: Award,
      color: 'bg-purple-600 shadow-purple-500/20 hover:border-purple-500',
      accentClass: 'via-purple-400',
      action: () => openReportList('DELEGADO')
    },
    {
      id: 'PENSIONADO',
      title: 'Jubilados y Pensionados',
      description: 'Listado de miembros jubilados y pensionados del sindicato.',
      icon: Heart,
      color: 'bg-pink-600 shadow-pink-500/20 hover:border-pink-500',
      accentClass: 'via-pink-400',
      action: () => openReportList('PENSIONADO')
    },
    {
      id: 'complaints',
      title: 'Quejas de Agremiados',
      description: 'Concentrado e historial de quejas y reportes de los miembros.',
      icon: FileWarning,
      color: 'bg-rose-600 shadow-rose-500/20 hover:border-rose-500',
      accentClass: 'via-rose-400',
      action: () => openReportList('complaints')
    }
  ];

  // Logic calculation for filtered & sorted items in detail view
  const sortedFiltered = getSortedFilteredItems();
  const selectedFilteredCount = getSelectedFilteredCount(sortedFiltered);
  const selectedItemsList = sortedFiltered.filter(item => selectedIds.has(item.id));

  // Pagination calculation
  const totalItems = sortedFiltered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedItems = sortedFiltered.slice(startIndex, startIndex + itemsPerPage);

  const goToNextPage = () => {
    if (activePage < totalPages) setCurrentPage(activePage + 1);
  };

  const goToPrevPage = () => {
    if (activePage > 1) setCurrentPage(activePage - 1);
  };

  const innerContent = (
    <div className={inline ? "w-full h-full bg-white flex flex-col min-h-0" : "w-full max-w-6xl bg-white border border-gray-100 shadow-xl rounded-[2rem] overflow-hidden flex flex-col h-[calc(100vh-100px)] min-h-[600px]"}>
      
      {/* VIEW 1: CARDS GRID (When no report is selected) */}
      {!selectedReport && (
        <>
          {/* Header */}
          <div className="px-5 py-5 md:px-10 md:py-8 bg-white border-b border-gray-100 flex items-center gap-4 shrink-0">
            {inline ? (
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
          </>
        )}

        {/* VIEW 2: INTELLIGENT LIST VIEW (When a report is selected) */}
        {selectedReport && (
          <div className="flex flex-col h-full min-h-0 bg-white">
            {/* Header / Navigation */}
            <div className="px-5 py-5 md:px-10 bg-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={() => setSelectedReport(null)}
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full text-slate-700 hover:bg-slate-100 gap-1.5 px-3 py-1 font-bold text-xs uppercase"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </Button>
                <div className="flex items-center gap-3">
                  <div className={`${selectedReport.color.split(' ')[0]} w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md`}>
                    {React.createElement(selectedReport.icon, { className: "w-5 h-5" })}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-blue-900 uppercase tracking-tight leading-tight">
                      {selectedReport.title}
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      Lista inteligente con filtro y selección de reportes
                    </p>
                  </div>
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  onClick={() => handleGeneratePDF(selectedItemsList)}
                  disabled={isLoadingData || selectedFilteredCount === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] md:text-xs uppercase tracking-wider rounded-2xl py-5 px-5 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Generar PDF ({selectedFilteredCount})
                </Button>
                <Button
                  onClick={() => handleGenerateExcel(selectedItemsList)}
                  disabled={isLoadingData || selectedFilteredCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] md:text-xs uppercase tracking-wider rounded-2xl py-5 px-5 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Descargar Excel ({selectedFilteredCount})
                </Button>
              </div>
            </div>

            {/* Toolbar Filters */}
            <div className="px-5 py-4 md:px-10 bg-slate-50/50 border-b border-gray-100 shrink-0">
              {isLoadingData ? (
                <div className="h-10 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">Cargando base de datos...</span>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                  {/* Search box */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o número de nómina..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                    />
                  </div>

                  {/* Filter dropdowns */}
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedReport.id === 'complaints' ? (
                      <>
                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-slate-400" />
                          <select
                            value={complaintStatus}
                            onChange={(e) => { setComplaintStatus(e.target.value as any); setCurrentPage(1); }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                          >
                            <option value="ALL">Todos los Estatus ({getFilteredComplaintsCount('ALL')})</option>
                            <option value="PENDIENTE">Solo Pendientes ({getFilteredComplaintsCount('PENDIENTE')})</option>
                            <option value="RESUELTO">Solo Atendidas ({getFilteredComplaintsCount('RESUELTO')})</option>
                          </select>
                        </div>

                        {/* Date Filters */}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="date"
                            value={complaintDateStart}
                            onChange={(e) => { setComplaintDateStart(e.target.value); setCurrentPage(1); }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-sm"
                          />
                          <span className="text-xs text-gray-400 font-bold">a</span>
                          <input
                            type="date"
                            value={complaintDateEnd}
                            onChange={(e) => { setComplaintDateEnd(e.target.value); setCurrentPage(1); }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-sm"
                          />
                        </div>
                      </>
                    ) : (
                      /* Member Department Filter */
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                          value={selectedDept}
                          onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
                          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm max-w-xs md:max-w-md"
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
                </div>
              )}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-x-auto min-h-0 bg-slate-50/20">
              {isLoadingData ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">
                    Cargando información del padrón...
                  </p>
                </div>
              ) : paginatedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Users className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-800 uppercase">Sin Registros Coincidentes</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Prueba cambiando los filtros o la búsqueda.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left bg-white">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-100">
                      {/* Checkbox Header */}
                      <th className="px-4 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected(sortedFiltered)}
                          onChange={() => toggleSelectAllFiltered(sortedFiltered)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-4 w-16 text-center text-xs font-black uppercase tracking-wider">No.</th>
                      <th className="px-4 py-4 w-24 text-center text-xs font-black uppercase tracking-wider">Nómina</th>
                      <th className="px-4 py-4 text-xs font-black uppercase tracking-wider">Nombre del Trabajador</th>
                      <th className="px-4 py-4 text-xs font-black uppercase tracking-wider">Secretaría / Dirección</th>
                      
                      {selectedReport.id === 'complaints' ? (
                        <>
                          <th className="px-4 py-4 w-28 text-center text-xs font-black uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-4 text-xs font-black uppercase tracking-wider">Detalle Queja</th>
                          <th className="px-4 py-4 text-xs font-black uppercase tracking-wider">Seguimiento / Estatus</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-4 text-xs font-black uppercase tracking-wider">Puesto Oficial</th>
                          <th className="px-4 py-4 w-24 text-center text-xs font-black uppercase tracking-wider">Estatus</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item, index) => {
                      const absoluteIndex = startIndex + index + 1;
                      
                      return (
                        <tr 
                          key={item.id}
                          className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors"
                        >
                          {/* Row Checkbox */}
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isRowSelected(item.id)}
                              onChange={() => handleRowSelect(item.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          
                          <td className="px-4 py-3.5 text-center text-xs text-slate-500 font-bold">
                            {absoluteIndex}
                          </td>
                          
                          <td className="px-4 py-3.5 text-center font-mono text-xs font-black text-slate-700">
                            {selectedReport.id === 'complaints' ? item.employee_id : item.employeeId || 'N/A'}
                          </td>
                          
                          <td className="px-4 py-3.5 text-xs font-black text-slate-800 uppercase">
                            {selectedReport.id === 'complaints' ? item.member_name : item.fullName || 'N/A'}
                          </td>
                          
                          <td className="px-4 py-3.5 text-xs text-slate-600 font-bold uppercase">
                            {selectedReport.id === 'complaints' ? item.member_department : item.department || 'N/A'}
                          </td>

                          {selectedReport.id === 'complaints' ? (
                            <>
                              <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-700">
                                {new Date(item.report_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3.5 text-[11px] text-slate-600 font-medium max-w-xs truncate">
                                {item.description || 'N/A'}
                              </td>
                              <td className="px-4 py-3.5 text-[11px] font-bold">
                                {item.follow_up ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 truncate block max-w-xs">{item.follow_up}</span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 block w-max">PENDIENTE</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3.5 text-xs text-slate-500 font-medium uppercase">
                                {item.position || 'N/A'}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  item.status === 'ACTIVO' 
                                    ? 'bg-emerald-105 bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {item.status || 'ACTIVO'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination / Footer Info */}
            {!isLoadingData && totalItems > 0 && (
              <div className="px-5 py-4 md:px-10 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-white z-10">
                <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Mostrando del <span className="text-slate-800 font-black">{startIndex + 1}</span> al{' '}
                  <span className="text-slate-800 font-black">{Math.min(startIndex + itemsPerPage, totalItems)}</span>{' '}
                  de <span className="text-slate-800 font-black">{totalItems}</span> registros |{' '}
                  Seleccionados: <span className="text-blue-600 font-black">{selectedFilteredCount}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={goToPrevPage}
                    disabled={activePage === 1}
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold text-xs uppercase px-3.5 py-1.5 h-auto text-slate-700 border-gray-200 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1 inline" />
                    Anterior
                  </Button>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                    Página {activePage} de {totalPages}
                  </span>
                  <Button
                    onClick={goToNextPage}
                    disabled={activePage === totalPages}
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold text-xs uppercase px-3.5 py-1.5 h-auto text-slate-700 border-gray-200 disabled:opacity-40"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1 inline" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );

  if (inline) {
    return innerContent;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8 pb-12">
      {innerContent}
    </div>
  );
}

export default function ReportesAgremiadosPage() {
  return <MemberReportsPanel />;
}
