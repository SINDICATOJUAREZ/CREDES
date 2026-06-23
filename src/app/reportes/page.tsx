'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, UserCheck, UserMinus, Award, Heart, FileWarning, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Member } from '@/types/member';
import Link from 'next/link';

export default function ReportesAgremiadosPage() {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

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

  const printCustomReport = async (typeFilter: 'ALL' | 'ACTIVO' | 'ESPERA' | 'DELEGADO' | 'PENSIONADO') => {
    setGeneratingReport(typeFilter);
    toast.info('Generando vista previa del reporte...');
    try {
      const r = await fetch('/api/members?limit=3000');
      const d = await r.json();
      const allMembers: Member[] = d.data || [];
      
      let filtered = allMembers;
      let title = 'PADRÓN GENERAL DE MIEMBROS';
      
      if (typeFilter !== 'ALL') {
        filtered = allMembers.filter(m => m.memberType === typeFilter);
        if (typeFilter === 'ACTIVO') title = 'PADRÓN GENERAL DE AGREMIADOS';
        else if (typeFilter === 'ESPERA') title = 'PADRÓN EN LISTA DE ESPERA';
        else if (typeFilter === 'DELEGADO') title = 'PADRÓN DE DELEGADOS SINDICALES';
        else if (typeFilter === 'PENSIONADO') title = 'PADRÓN DE JUBILADOS Y PENSIONADOS';
      }

      // Sort by fullName
      filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

      if (filtered.length === 0) {
        toast.warning('No se encontraron registros para este reporte.');
        setGeneratingReport(null);
        return;
      }

      const w = window.open('', '_blank');
      if (!w) { 
        toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); 
        setGeneratingReport(null);
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
    } catch (e: any) {
      toast.error('Error al generar el reporte: ' + e.message);
    } finally {
      setGeneratingReport(null);
    }
  };

  const printComplaintsReport = async () => {
    setGeneratingReport('complaints');
    toast.info('Generando concentrado de quejas...');
    try {
      const r = await fetch('/api/complaints');
      const d = await r.json();
      const allComplaints: any[] = d.complaints || [];

      if (allComplaints.length === 0) {
        toast.warning('No hay reportes de quejas en el sistema para imprimir.');
        setGeneratingReport(null);
        return;
      }

      const w = window.open('', '_blank');
      if (!w) { 
        toast.error('Popup bloqueado. Por favor permite las ventanas emergentes.'); 
        setGeneratingReport(null);
        return; 
      }

      const title = 'CONCENTRADO DE QUEJAS Y REPORTES DE AGREMIADOS';

      const rows = allComplaints.map((c, idx) => `
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
        <title>${title}</title>
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
              filename: 'Reporte_Quejas_Agremiados.pdf',
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
            <div class="summary-item">Total quejas registradas: <span>${allComplaints.length}</span></div>
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
              ${rows}
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
    } catch (e: any) {
      toast.error('Error al generar reporte de quejas: ' + e.message);
    } finally {
      setGeneratingReport(null);
    }
  };

  const reportsList = [
    {
      id: 'ALL',
      title: 'Padrón Completo',
      description: 'Reporte general de todos los miembros registrados en el sistema.',
      icon: Users,
      color: 'bg-blue-600 shadow-blue-500/20 hover:border-blue-500',
      action: () => printCustomReport('ALL')
    },
    {
      id: 'ACTIVO',
      title: 'Agremiados Activos',
      description: 'Padrón de miembros que actualmente se encuentran activos.',
      icon: UserCheck,
      color: 'bg-emerald-600 shadow-emerald-500/20 hover:border-emerald-500',
      action: () => printCustomReport('ACTIVO')
    },
    {
      id: 'ESPERA',
      title: 'Lista de Espera',
      description: 'Listado de miembros que se encuentran en estatus de espera.',
      icon: UserMinus,
      color: 'bg-amber-600 shadow-amber-500/20 hover:border-amber-500',
      action: () => printCustomReport('ESPERA')
    },
    {
      id: 'DELEGADO',
      title: 'Delegados Sindicales',
      description: 'Listado de miembros que actúan como delegados oficiales.',
      icon: Award,
      color: 'bg-purple-600 shadow-purple-500/20 hover:border-purple-500',
      action: () => printCustomReport('DELEGADO')
    },
    {
      id: 'PENSIONADO',
      title: 'Jubilados y Pensionados',
      description: 'Listado de miembros jubilados y pensionados del sindicato.',
      icon: Heart,
      color: 'bg-pink-600 shadow-pink-500/20 hover:border-pink-500',
      action: () => printCustomReport('PENSIONADO')
    },
    {
      id: 'complaints',
      title: 'Quejas de Agremiados',
      description: 'Concentrado e historial de quejas y reportes de los miembros.',
      icon: FileWarning,
      color: 'bg-rose-600 shadow-rose-500/20 hover:border-rose-500',
      action: () => printComplaintsReport()
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
              Generación de padrones generales y concentrados de quejas en formato PDF
            </p>
          </div>
        </div>

        {/* Content / Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50/30 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportsList.map((item) => {
              const IconComponent = item.icon;
              const isProcessing = generatingReport === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  disabled={generatingReport !== null}
                  className="w-full text-left bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="w-full flex flex-col h-full justify-between">
                    <div>
                      {/* Icon wrapper */}
                      <div className={`${item.color.split(' ')[0]} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform mb-5`}>
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <IconComponent className="w-6 h-6" />
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                        {item.title}
                        {isProcessing && <span className="text-[10px] text-blue-600 font-bold normal-case animate-pulse">(Generando...)</span>}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
