'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Users, X, Printer } from 'lucide-react';
import { Member } from '@/types/member';
import { generateResumePDF } from '@/lib/pdf-generator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PensionersDialog({ isOpen, onClose }: Props) {
  const [list, setList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) calc();
  }, [isOpen]);

  const parseDate = (dateStr: string | any) => {
    if (!dateStr) return null;
    // Handle Date objects
    if (dateStr instanceof Date) return dateStr;
    // Handle numbers (timestamps)
    if (typeof dateStr === 'number') return new Date(dateStr);
    // Standard string parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Manual parsing for common formats
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
      // Fetch active types in parallel to get a better sample
      const types = ['ACTIVO', 'DELEGADO', 'SECRETARIO_GENERAL'];
      const responses = await Promise.all(
        types.map(t => fetch(`/api/members?limit=2000&memberType=${t}`))
      );
      
      const results = await Promise.all(responses.map(r => r.json()));
      const allMembers: Member[] = results.flatMap(d => d.data || []);
      
      // Also fetch by status ACTIVO for good measure (some might have other memberTypes but still be active)
      const rStatus = await fetch('/api/members?limit=2000&status=ACTIVO');
      const dStatus = await rStatus.json();
      const statusActive = dStatus.data || [];
      
      // Fetch members with INCAPACITADO status
      const rIncap = await fetch('/api/members?limit=2000&status=INCAPACITADO');
      const dIncap = await rIncap.json();
      const statusIncap = dIncap.data || [];
      
      // Merge and deduplicate
      const merged = [...allMembers, ...statusActive, ...statusIncap];
      const uniqueIds = new Set();
      const uniqueMembers = merged.filter(m => {
        if (uniqueIds.has(m.id)) return false;
        uniqueIds.add(m.id);
        return true;
      });

      const today = new Date();
      const filtered = uniqueMembers.filter(m => {
        const bDate = parseDate(m.birthDate);
        const jDate = parseDate(m.joinDate);
        if (!jDate) return false;

        let years = today.getFullYear() - jDate.getFullYear();
        if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;

        // Case 1: Incapacitated (10 or more years working in the municipality, age doesn't matter)
        const isIncapacitated = m.status === 'INCAPACITADO';
        if (isIncapacitated) {
          return years >= 10;
        }

        // Case 2: Standard Pension (age > 50 and years >= 15)
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
        
        return { 
          ...m, 
          calculatedAge: age, 
          calculatedYears: years, 
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

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-7xl h-[90vh] rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-gray-50/98 backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-5 md:px-10 md:py-8 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
          <div className="flex-1">
            <h2 className="text-2xl md:text-4xl font-black text-blue-900 uppercase tracking-tighter flex items-center gap-3 md:gap-4">
              <Users className="w-8 h-8 md:w-10 md:h-10 text-cyan-600 shrink-0" />
              Proyección de Pensiones
            </h2>
            <p className="text-[9px] md:text-[11px] text-gray-400 font-black uppercase tracking-widest md:tracking-[0.2em] italic mt-2 md:mt-1 md:ml-14 leading-tight">
              Edad y Antigüedad (&gt;50 años / &gt;=15 años serv.) o por Incapacidad (&gt;=10 años serv.)
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 ml-2 md:ml-0">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {list.map((m, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-xl hover:border-blue-200 transition-all duration-500">
                {m.pensionType === 'INCAPACIDAD' ? (
                  <div className="absolute top-0 left-0 px-4 py-2 rounded-br-3xl bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
                    Incapacidad
                  </div>
                ) : null}
                
                <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-white text-[10px] font-black uppercase tracking-widest shadow-sm ${m.pensionPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                  {m.pensionPct}% Pensión
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl border-2 border-gray-50 overflow-hidden shadow-inner bg-gray-50">
                    {m.photoUrl ? <img src={m.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-xl">{m.fullName.charAt(0)}</div>}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-blue-900 uppercase text-sm truncate leading-tight mb-1">{m.fullName}</h4>
                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest italic">{m.position}</p>
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
                
                <div className="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between items-center mb-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-black uppercase">Ingreso</span>
                    <span className="text-[11px] text-slate-700 font-bold">{m.joinDate}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-gray-400 font-black uppercase">Nómina</span>
                    <span className="text-[11px] text-slate-700 font-bold">#{m.employeeId}</span>
                  </div>
                </div>

                <button 
                  onClick={() => generateResumePDF(m)}
                  className="w-full py-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 group-hover:bg-blue-600 group-hover:text-white shadow-sm shadow-blue-100"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Expediente
                </button>
              </div>
            ))}
            {list.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
                <p className="text-gray-400 font-black uppercase tracking-widest italic">No se encontraron miembros elegibles para pensión próxima</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
