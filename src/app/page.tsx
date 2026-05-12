'use client';

import { useState } from 'react';
import { Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Users, LogOut } from 'lucide-react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Toaster, toast } from 'sonner';
import { MemberForm } from '@/components/members/MemberForm';
import { SystemSettingsDialog } from '@/components/members/SystemSettingsDialog';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleFormSubmit = async (data: Member) => {
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      toast.success('Agremiado registrado');
      setIsFormOpen(false);
      // Optional: Navigate to search to see the new member
      router.push('/agremiados');
    } catch (error) {
      toast.error('Error al guardar los cambios');
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center">
      <Toaster position="top-right" richColors closeButton />
      
      {/* Top Banner Area */}
      <div className="w-full bg-blue-900 h-2 mt-0"></div>

      <div className="max-w-6xl w-full mx-auto px-4 flex flex-col items-center">
        {/* LOGO 2 - AT THE VERY TOP */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 mb-4"
        >
          <img src="/logos/logo2.png" alt="SUTSMBJ Logo" className="h-48 w-auto drop-shadow-2xl" />
        </motion.div>

        {/* SYSTEM NAME */}
        <div className="text-center mb-10 px-4">
          <h1 className="text-4xl font-black text-blue-900 tracking-tight leading-tight">SICSUTSMBJ</h1>
          <p className="text-lg font-bold text-gray-600 mt-2 max-w-3xl mx-auto">
            Sistema Integral de Credencialización Del Sindicato Único de Trabajadores al Servicio del Municipio de Benito Juárez Nuevo León.
          </p>
        </div>

        {/* MAIN BUTTONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-12">
          {[
            { 
              title: 'Crear agremiado', 
              icon: Plus, 
              color: 'bg-blue-600',
              action: () => setIsFormOpen(true)
            },
            { 
              title: 'Buscar agremiado', 
              icon: Search, 
              color: 'bg-indigo-600',
              href: '/agremiados'
            },
            { 
              title: 'Reportes de asistencia', 
              icon: FileText, 
              color: 'bg-blue-500',
              href: '/asistencias'
            },
            { 
              title: 'Futuros pensionados', 
              icon: Users, 
              color: 'bg-cyan-600',
              href: '/pensionados'
            }
          ].map((item, i) => {
            const ButtonContent = (
              <>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className={`${item.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-110 group-hover:rotate-3 transition-all`}>
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-gray-800 px-4 text-center leading-tight uppercase tracking-wide">
                  {item.title}
                </h3>
              </>
            );

            return item.href ? (
              <Link href={item.href} key={item.title} className="group relative h-48 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all hover:-translate-y-2 hover:shadow-2xl hover:border-blue-100 active:scale-95 overflow-hidden">
                {ButtonContent}
              </Link>
            ) : (
              <button
                key={item.title}
                onClick={item.action}
                className="group relative h-48 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all hover:-translate-y-2 hover:shadow-2xl hover:border-blue-100 active:scale-95 overflow-hidden"
              >
                {ButtonContent}
              </button>
            );
          })}
        </div>

        <div className="mt-auto pb-8 opacity-20">
          <img src="/logos/logo.png" alt="SUTSMBJ Logo" className="h-12 grayscale" />
        </div>
      </div>

      {/* GEAR BUTTON FOR CAMERA SETTINGS */}
      <div className="fixed bottom-8 left-8">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsSettingsOpen(true)}
          className="w-14 h-14 rounded-2xl border-gray-200 bg-white shadow-xl hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-all active:scale-95 group"
        >
          <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
        </Button>
      </div>

      <SystemSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* MODAL PARA CREAR AGREMIADO */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1150px] max-h-[95vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <MemberForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
