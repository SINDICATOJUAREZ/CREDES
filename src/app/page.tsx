'use client';

import { useState, useEffect } from 'react';
import { Member } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Users, LogOut, Award, Settings, Gift, FileWarning, Printer } from 'lucide-react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Toaster, toast } from 'sonner';
import { MemberForm } from '@/components/members/MemberForm';
import { SystemSettingsDialog } from '@/components/members/SystemSettingsDialog';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

// Import sub-pages as components for modal integration
import { MemberDirectoryPanel } from '@/components/members/MemberDirectoryPanel';
import { PrintDirectoryPanel } from '@/components/members/PrintDirectoryPanel';
import { AttendanceReportsDialog } from '@/components/reports/AttendanceReportsDialog';
import { MemberReportsPanel } from '@/components/reports/MemberReportsPanel';
import { PensionersDialog } from '@/components/reports/PensionersDialog';

export default function Home() {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState<{ 
    fullName: string; 
    role: string; 
    permissions?: Record<string, boolean>;
  } | null>(null);

  // States for unified modal windows
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImpresionesOpen, setIsImpresionesOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isPensionersOpen, setIsPensionersOpen] = useState(false);
  const [attendanceTab, setAttendanceTab] = useState<'busqueda' | 'cumpleanos'>('busqueda');
  const [reportsInitialTab, setReportsInitialTab] = useState<string | null>(null);

  useEffect(() => {
    // 1. Instant loading from localStorage
    const localUser = localStorage.getItem('user');
    if (localUser) {
      try {
        setUser(JSON.parse(localUser));
      } catch (e) {}
    }

    // 2. Fetch fresh session from server
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      })
      .catch(() => {});
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

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
      
      // If the directory modal is open, trigger a refresh on it by reloading or resetting state
      if (isSearchOpen) {
        // Just trigger search open refresh if necessary, page state uses useSWR which auto-refreshes on focus
      }
    } catch (error) {
      toast.error('Error al guardar los cambios');
    }
  };

  const MENU_ITEMS = [
    { 
      title: 'Crear agremiado', 
      description: 'Registra un nuevo miembro en el sistema y captura su fotografía.',
      icon: Plus, 
      color: 'from-blue-500 to-blue-600',
      action: () => setIsFormOpen(true),
      permission: 'canCreateMember'
    },
    { 
      title: 'Buscar agremiado', 
      description: 'Consulta el padrón completo, edita datos e imprime credenciales.',
      icon: Search, 
      color: 'from-indigo-500 to-indigo-600',
      action: () => setIsSearchOpen(true),
      permission: 'canSearchMember'
    },
    { 
      title: 'Impresiones', 
      description: 'Busca agremiados e imprime sus credenciales con datos básicos.',
      icon: Printer, 
      color: 'from-emerald-500 to-emerald-600',
      action: () => setIsImpresionesOpen(true),
      permission: 'canSearchMember'
    },
    { 
      title: 'Reportes de asistencia', 
      description: 'Consulta listas de asistencia por eventos, cumpleaños y firmas.',
      icon: FileText, 
      color: 'from-sky-500 to-sky-600',
      action: () => {
        setAttendanceTab('busqueda');
        setIsAttendanceOpen(true);
      },
      permission: 'canViewReports'
    },
    { 
      title: 'Cumpleaños', 
      description: 'Consulta los cumpleaños del mes y felicita a los agremiados.',
      icon: Gift, 
      color: 'from-rose-500 to-rose-600',
      action: () => {
        setAttendanceTab('cumpleanos');
        setIsAttendanceOpen(true);
      },
      permission: 'canViewBirthdays'
    },
    { 
      title: 'Reportes de agremiados', 
      description: 'Genera reportes personalizados de padrones y exporta en PDF/Excel.',
      icon: Award, 
      color: 'from-violet-500 to-violet-600',
      action: () => {
        setReportsInitialTab(null);
        setIsReportsOpen(true);
      },
      permission: 'canViewMemberReports'
    },
    { 
      title: 'Formato de Apoyo', 
      description: 'Concentrado e historial de formatos de apoyo de los miembros.',
      icon: FileWarning, 
      color: 'from-rose-500 to-rose-600',
      action: () => {
        setReportsInitialTab('complaints');
        setIsReportsOpen(true);
      },
      permission: 'canViewComplaints'
    },
    { 
      title: 'Futuros pensionados', 
      description: 'Administra y proyecta los agremiados próximos a jubilarse.',
      icon: Users, 
      color: 'from-cyan-500 to-cyan-600',
      action: () => setIsPensionersOpen(true),
      permission: 'canViewPensioners'
    }
  ];

  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return !!user.permissions?.[item.permission];
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
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
          className="mt-6 mb-4"
        >
          <img src="/logos/logo2.png" alt="SUTSMBJ Logo" className="h-36 w-auto object-contain drop-shadow-xl" />
        </motion.div>

        {/* SYSTEM NAME */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-4xl font-black text-blue-900 tracking-tight leading-tight">SICSUTSMBJ</h1>
          <p className="text-base font-bold text-gray-500 mt-2 max-w-3xl mx-auto">
            Sistema Integral de Credencialización Del Sindicato Único de Trabajadores al Servicio del Municipio de Benito Juárez Nuevo León.
          </p>
        </div>

        {/* USER WELCOME & SESSION PANEL */}
        {user && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full relative p-6 bg-gray-50 border border-gray-100 rounded-3xl mb-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between min-h-[5.5rem] gap-4"
          >
            <div className="flex items-center gap-4 pr-24 sm:pr-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-md flex-shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-gray-400">{getGreeting()},</p>
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">{user.fullName}</h2>
              </div>
            </div>
            
            {/* Upper Right Action Buttons */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {user.role === 'MASTER' && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-10 h-10 rounded-xl border-gray-200 bg-white shadow-sm hover:bg-blue-50 hover:border-blue-200 text-gray-500 hover:text-blue-600 transition-all active:scale-95 group"
                  title="Configuración del Sistema"
                >
                  <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                </Button>
              )}
              <button
                onClick={async () => {
                  try {
                    localStorage.removeItem('user');
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/login';
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-red-50 hover:border-red-200 text-gray-500 hover:text-red-600 transition-all active:scale-95 group"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* MAIN BUTTONS GRID */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-12"
        >
          {visibleMenuItems.map((item) => {
            const CardContent = (
              <div className="flex flex-col items-center justify-center p-6 h-full text-center gap-4 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className={`bg-gradient-to-br ${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <item.icon className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-2 flex-1 justify-center">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide leading-tight group-hover:text-blue-900 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-medium text-gray-400 leading-normal line-clamp-3">
                    {item.description}
                  </p>
                </div>
              </div>
            );

            const cardClasses = "group relative h-56 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-[2rem] flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-blue-100 active:scale-95 overflow-hidden cursor-pointer w-full text-left";

            return (
              <motion.div key={item.title} variants={itemVariants} className="w-full">
                <button
                  onClick={item.action}
                  className={cardClasses}
                >
                  {CardContent}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mt-auto pb-8 opacity-20">
          <img src="/logos/logo.png" alt="SUTSMBJ Logo" className="h-12 grayscale" />
        </div>
      </div>

      <SystemSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* MODAL PARA CREAR AGREMIADO */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1150px] max-h-[95vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <MemberForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* MODAL PARA BUSCAR AGREMIADO (DIRECTORIO) */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1300px] h-[90vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <MemberDirectoryPanel inline={true} onClose={() => setIsSearchOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* MODAL PARA IMPRESIONES DE CREDENCIALES */}
      <Dialog open={isImpresionesOpen} onOpenChange={setIsImpresionesOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1300px] h-[90vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <PrintDirectoryPanel inline={true} onClose={() => setIsImpresionesOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* MODAL PARA REPORTES DE ASISTENCIA Y CUMPLEAÑOS */}
      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent className={attendanceTab === 'cumpleanos'
          ? "max-w-[95vw] md:max-w-[900px] h-[75vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white"
          : "max-w-[95vw] md:max-w-[1300px] h-[90vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white"
        }>
          <AttendanceReportsDialog 
            inline={true} 
            initialTab={attendanceTab} 
            onlyShowBirthdays={attendanceTab === 'cumpleanos'} 
            onClose={() => setIsAttendanceOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* MODAL PARA REPORTES DE AGREMIADOS */}
      <Dialog open={isReportsOpen} onOpenChange={setIsReportsOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1300px] h-[90vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <MemberReportsPanel inline={true} initialReport={reportsInitialTab} onClose={() => setIsReportsOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* MODAL PARA FUTUROS PENSIONADOS */}
      <Dialog open={isPensionersOpen} onOpenChange={setIsPensionersOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1300px] h-[90vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <PensionersDialog inline={true} onClose={() => setIsPensionersOpen(false)} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
