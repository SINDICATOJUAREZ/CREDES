'use client';

import React from 'react';
import { Member, CredentialConfig } from '@/types/member';
import { QRCodeSVG } from 'qrcode.react';
import { useQR } from '@/hooks/useQR';
import { motion } from 'framer-motion';

interface CredentialCardProps {
  member: Member;
  config: CredentialConfig;
  className?: string;
  id?: string;
}

export const CredentialCard: React.FC<CredentialCardProps> = ({ member, config, className, id }) => {
  const { generateQRValue } = useQR();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-[85.6mm] h-[54mm] bg-white rounded-[3mm] shadow-2xl overflow-hidden relative border border-gray-200 flex flex-col select-none ${className}`}
      id={id || `credential-${member.id}`}
    >
      {/* Background Image */}
      {config.backgroundUrl && (
        <img 
          src={config.backgroundUrl} 
          alt="Background" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        />
      )}

      {/* Header */}
      {(config.showTemplate !== false) && (
        <div 
          className="text-white h-[13mm] flex justify-between items-center px-[3mm] relative z-10 border-b-[0.5mm] border-yellow-500"
          style={{ backgroundColor: config.primaryColor }}
        >
        <div className="w-[10mm] h-[10mm] bg-white rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-sm p-[1mm]">
          <img src="/logos/logo.png" alt="SUTSMBJ" className="w-full h-full object-contain" />
        </div>
        
        <div className="text-center flex-1 px-2">
          <h2 className="text-[5.5px] font-bold leading-tight uppercase tracking-wider opacity-90">Sindicato Único de Trabajadores de</h2>
          <h1 className="text-[10px] font-black leading-tight uppercase tracking-tighter">Ciudad Benito Juárez</h1>
          <p className="text-[5px] opacity-70 italic font-medium">"Unidad, Trabajo y Justicia Social"</p>
        </div>

        <div className="w-[10mm] h-[10mm] bg-white rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-sm p-[1.5mm]">
          <img src="/logos/logo2.png" alt="CBJ" className="w-full h-full object-contain" />
        </div>
      </div>
      )}

      {/* Body Area */}
      <div className="flex flex-1 p-[3mm] bg-transparent relative z-10">
        {/* Photo Container */}
        {(config.showTemplate !== false) && (
        <div className="w-[26mm] flex flex-col items-center">
          <div 
            className="w-[24mm] h-[28mm] border-[0.8mm] bg-gray-50 rounded-[0.5mm] overflow-hidden flex items-center justify-center relative shadow-md"
            style={{ borderColor: config.primaryColor }}
          >
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 opacity-20">
                <div className="w-8 h-8 rounded-full bg-gray-400"></div>
                <div className="text-gray-600 text-[5px] font-black uppercase">Sin Fotografía</div>
              </div>
            )}
          </div>
          <div 
            className="mt-[1.5mm] text-white px-[3mm] py-[0.5mm] rounded-sm text-[6px] font-black tracking-widest border-b border-yellow-500"
            style={{ backgroundColor: config.primaryColor }}
          >
            SOCIO: {member.socioId || '0000'}
          </div>
        </div>
        )}

      </div>

      {/* Dynamic Elements (Absolute to whole card) */}
      {config.elements.map(el => {
        if (!el.isVisible) return null;
        
        if (el.type === 'qr') {
          return (
            <div 
              key={el.id}
              className="absolute bg-white p-[1mm] rounded-[1mm] shadow-sm border border-gray-100 z-30"
              style={{ 
                left: `${el.x}mm`, 
                top: `${el.y}mm`,
                width: `${el.w || 20}mm`,
                height: `${el.h || 20}mm`
              }}
            >
              <QRCodeSVG 
                value={generateQRValue(member)} 
                width="100%"
                height="100%"
                level="H"
              />
            </div>
          );
        }

        const value = el.field === 'fixed_text' ? el.fixedText : (member[el.field as keyof Member] as string);

        return (
          <div 
            key={el.id}
            className="absolute whitespace-nowrap overflow-hidden text-ellipsis max-w-full z-30 flex"
            style={{ 
              left: `${el.x}mm`, 
              top: `${el.y}mm`,
              width: el.w ? `${el.w}mm` : 'auto',
              height: el.h ? `${el.h}mm` : 'auto',
              fontSize: `${el.fontSize || 7}pt`,
              color: el.color || '#000000',
              fontWeight: el.fontWeight === 'black' ? 900 : (el.fontWeight === 'bold' ? 700 : 400),
              textTransform: 'uppercase',
              alignItems: el.alignment === 'center' ? 'center' : 'flex-start',
              justifyContent: el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {value || '---'}
          </div>
        );
      })}

      {/* Expiry / Footer Info */}
      {(config.showTemplate !== false) && (
      <div className="absolute bottom-[3.5mm] left-[32mm] z-20 flex flex-col">
        <label className="text-[4.5px] text-[#003366] uppercase font-black opacity-50">Vigencia Credencial</label>
        <div className="bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[5.5px] font-black w-fit">
          {member.expiryDate || '---'}
        </div>
      </div>
      )}

      {/* Bottom Bar */}
      {(config.showTemplate !== false) && (
      <div className="h-[1.5mm] w-full mt-auto flex items-center justify-center relative" style={{ backgroundColor: config.primaryColor }}>
         <div className="h-[0.5mm] w-[80%] bg-yellow-500 opacity-50"></div>
         <div className="absolute right-2 text-[4px] text-white/50 font-black tracking-tighter">VENCIMIENTO: 1 AÑO</div>
      </div>
      )}
    </motion.div>
  );
};
