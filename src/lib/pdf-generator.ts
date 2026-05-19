import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Member, CredentialConfig } from '@/types/member';
import QRCode from 'qrcode';
import { toast } from 'sonner';

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    let targetUrl = url;
    if (url.startsWith('/') && typeof window !== 'undefined') {
      targetUrl = window.location.origin + url;
    }
    const res = await fetch(targetUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', url, error);
    return '';
  }
};

// Vectorial Generator
export const generateVectorialCredentialPDF = async (member: Member, config: CredentialConfig, fileName: string) => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 54]
  });

  // Background
  if (config.backgroundUrl) {
    const bgBase64 = await fetchImageAsBase64(config.backgroundUrl);
    if (bgBase64) {
      // Sometimes jpeg or png
      const format = bgBase64.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(bgBase64, format, 0, 0, 85.6, 54);
    }
  } else {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 85.6, 54, 'F');
  }

  const showTemplate = config.showTemplate !== false;

  if (showTemplate) {
    // Header static elements (mirroring CredentialCard layout)
    pdf.setFillColor(config.primaryColor || '#003366');
    pdf.rect(0, 0, 85.6, 13, 'F');
    pdf.setDrawColor(234, 179, 8); // border-yellow-500
    pdf.setLineWidth(0.5);
    pdf.line(0, 13, 85.6, 13);

    const logo1 = await fetchImageAsBase64('/logos/logo.png');
    if (logo1) {
      pdf.setFillColor(255, 255, 255);
      pdf.circle(8, 6.5, 5, 'F');
      pdf.addImage(logo1, 'PNG', 4, 2.5, 8, 8);
    }

    const logo2 = await fetchImageAsBase64('/logos/logo2.png');
    if (logo2) {
      pdf.setFillColor(255, 255, 255);
      pdf.circle(77.6, 6.5, 5, 'F');
      pdf.addImage(logo2, 'PNG', 73.6, 2.5, 8, 8);
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(5.5);
    pdf.text('Sindicato Único de Trabajadores de', 42.8, 4.5, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text('Ciudad Benito Juárez', 42.8, 8.5, { align: 'center' });
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5);
    pdf.text('"Unidad, Trabajo y Justicia Social"', 42.8, 11.5, { align: 'center' });

    // Photo Container
    pdf.setFillColor(249, 250, 251); // gray-50
    pdf.setDrawColor(config.primaryColor || '#003366');
    pdf.setLineWidth(0.8);
    pdf.rect(4, 16, 24, 28, 'FD'); // FD = fill and stroke
    
    if (member.photoUrl) {
      const photoBase64 = await fetchImageAsBase64(member.photoUrl);
      if (photoBase64) {
        const format = photoBase64.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(photoBase64, format, 4.4, 16.4, 23.2, 27.2);
      }
    }

    // Socio Badge
    pdf.setFillColor(config.primaryColor || '#003366');
    pdf.rect(4, 45.5, 24, 4, 'F');
    pdf.setDrawColor(234, 179, 8); // yellow-500
    pdf.setLineWidth(0.2);
    pdf.line(4, 49.5, 28, 49.5);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.text(`SOCIO: ${member.socioId || '0000'}`, 16, 48.5, { align: 'center' });
  } else if (member.photoUrl) {
     // Even if template is hidden, we might want to draw the photo if it's NOT an element
     // But wait, if it's NOT an element, it won't show.
     // In the vector generator, the photo is hardcoded.
     // Let's check if there's a 'foto' element in config.
     const hasPhotoElement = config.elements.some(el => (el.field as string) === 'foto' || (el as any).tipo === 'imagen');
     if (!hasPhotoElement) {
        const photoBase64 = await fetchImageAsBase64(member.photoUrl);
        if (photoBase64) {
          const format = photoBase64.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(photoBase64, format, 4.4, 16.4, 23.2, 27.2);
        }
     }
  }

  // Dynamic Elements
  for (const el of config.elements) {
    if (!el.isVisible) continue;
    
    const x = el.x;
    const y = el.y;

    if (el.type === 'qr') {
      const qrData = JSON.stringify({
        id: member.id,
        nombre: member.fullName,
        nomina: member.employeeId,
        socio: member.socioId,
        tipo: member.memberType
      });
      const qrBase64 = await QRCode.toDataURL(qrData, { margin: 1, errorCorrectionLevel: 'H' });
      pdf.addImage(qrBase64, 'PNG', x, y, el.w || 20, el.h || 20);
      continue;
    }

    const value = el.field === 'fixed_text' ? el.fixedText : (member[el.field as keyof Member] as string);
    if (!value) continue;

    const fontSize = el.fontSize || 7;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', el.fontWeight === 'bold' || el.fontWeight === 'black' ? 'bold' : 'normal');
    pdf.setTextColor(el.color || '#000000');

    let textX = x;
    let align: 'left' | 'center' | 'right' = 'left';
    
    if (el.alignment === 'center') {
      align = 'center';
      textX = x + ((el.w || 20) / 2);
    } else if (el.alignment === 'right') {
      align = 'right';
      textX = x + (el.w || 20);
    }

    // jsPDF baseline adjustment: y + (fontSize * 0.35)
    // If alignment is center in UI, it also centers vertically in the bounding box
    // To match vertical centering if alignment === 'center', we shift baseline by half the height difference
    let textY = y + (fontSize * 0.35);
    if (el.alignment === 'center' && el.h) {
      textY = y + (el.h / 2) + (fontSize * 0.35) / 2; // Approximating middle baseline
    }

    pdf.text((value || '').toUpperCase(), textX, textY, { align });
  }

  // Expiry
  if (showTemplate) {
    pdf.setTextColor(0, 51, 102);
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('VIGENCIA CREDENCIAL', 32, 50.5);
    pdf.setFillColor(234, 179, 8);
    pdf.rect(32, 51, 15, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(5.5);
    pdf.text(member.expiryDate || '---', 39.5, 52.5, { align: 'center' });

    // Bottom Bar
    pdf.setFillColor(config.primaryColor || '#003366');
    pdf.rect(0, 52.5, 85.6, 1.5, 'F');
  }

  pdf.save(`${fileName}.pdf`);
};

// Legacy Generator (Fallback)
export const generateCredentialPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const canvas = await html2canvas(element, { scale: 4, useCORS: true, backgroundColor: null });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
    pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
    pdf.save(`${fileName}.pdf`);
  } catch (error) { console.error('Error generating PDF:', error); }
};

export const downloadCredentialImage = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const canvas = await html2canvas(element, { scale: 4, useCORS: true, backgroundColor: null });
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) { console.error('Error:', error); }
};

export const generateBulkPDF = async (elementIds: string[], fileName: string) => {
  // Keeping this for backwards compatibility, though mass printing should be vectorized too in the future
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardW = 85.6; const cardH = 54; const marginX = 15; const marginY = 20; const gap = 5;
  for (let i = 0; i < elementIds.length; i++) {
    const element = document.getElementById(elementIds[i]);
    if (!element) continue;
    const canvas = await html2canvas(element, { scale: 3, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const col = i % 2; const row = Math.floor(i / 2) % 4;
    if (i > 0 && i % 8 === 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', marginX + col * (cardW + gap), marginY + row * (cardH + gap), cardW, cardH);
  }
  pdf.save(`${fileName}_Masivo.pdf`);
};

export const generateResumePDF = async (member: Member) => {
  toast.info('Generando expediente en formato PDF...');
  
  try {
    const pdf = new jsPDF();
    
    // Header - Centered logo2 (wide widescreen aspect ratio)
    const logo2Base64 = await fetchImageAsBase64('/logos/logo2.png');
    if (logo2Base64) {
      pdf.addImage(logo2Base64, 'PNG', 75, 10, 60, 16);
    }
    
    pdf.setTextColor(0, 51, 102);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('EXPEDIENTE DEL AGREMIADO', 105, 38, { align: 'center' });
    
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(20, 44, 190, 44);
    
    // Section: INFORMACIÓN GENERAL
    pdf.setTextColor(0, 51, 102);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMACIÓN GENERAL', 20, 52);
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(0.5);
    pdf.line(20, 54, 190, 54);
    
    // Member Photo
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.rect(155, 58, 30, 35);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('SIN FOTO', 170, 76, { align: 'center' });
    
    if (member.photoUrl) {
      const photoBase64 = await fetchImageAsBase64(member.photoUrl);
      if (photoBase64) {
        const format = photoBase64.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(photoBase64, format, 155, 58, 30, 35);
      }
    }
    
    // Text fields on the left
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Nombre:', 20, 64);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.fullName || '---', 55, 64);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('CURP:', 20, 71);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.curp || '---', 55, 71);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('No. Nómina:', 20, 78);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.employeeId || '---', 55, 78);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('No. Socio:', 20, 85);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.socioId || '---', 55, 85);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Puesto Actual:', 20, 92);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.position || '---', 55, 92);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Departamento:', 20, 99);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.department || '---', 55, 99);
    
    // Section: DATOS DE CONTACTO
    pdf.setTextColor(0, 51, 102);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATOS DE CONTACTO', 20, 112);
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(0.5);
    pdf.line(20, 114, 190, 114);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Teléfono:', 20, 122);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.phone || '---', 55, 122);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', 20, 129);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.email || '---', 55, 129);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Domicilio:', 20, 136);
    pdf.setFont('helvetica', 'normal');
    pdf.text(member.address || '---', 55, 136);
    
    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Uso exclusivo del Sindicato Único de Trabajadores.', 105, 285, { align: 'center' });
    
    pdf.save(`Expediente_${member.fullName.replace(/ /g, '_')}.pdf`);
    toast.success('Expediente descargado con éxito.');
  } catch (error) {
    console.error('Error generating resume PDF:', error);
    toast.error('Error al generar el PDF del expediente.');
  }
};
