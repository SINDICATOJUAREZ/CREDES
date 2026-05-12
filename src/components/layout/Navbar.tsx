'use client';

import React from 'react';
import { CreditCard, Users, FileUp, Settings, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <img src="/logos/logo.png" alt="Logo Sindicato" className="h-12 w-auto object-contain" />
        <div className="h-8 w-[2px] bg-blue-100 hidden md:block"></div>
        <div className="hidden md:block">
          <h1 className="text-xl font-black text-gray-900 leading-none">SIC-SUTSMBJ</h1>
          <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase">Sistema Integral de Credencialización - SUTSMBJ</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Sistema Activo
        </div>
        <div className="h-8 w-[1px] bg-gray-100"></div>
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      </div>
    </nav>
  );
};
