'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Bienvenido, ${data.user.fullName}`);
        router.push('/');
        router.refresh();
      } else {
        toast.error(data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md p-1"
      >
        <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl p-10 relative overflow-hidden">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10 text-center">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20"
            >
              <ShieldCheck className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">SIC-<span className="text-blue-500">SUTSMBJ</span></h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide">Sistema de Control y Registro de Agremiados</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Correo Institucional</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <Input 
                  type="email" 
                  placeholder="admin@sutsmbj.gob.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-2xl transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Contraseña</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <Input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-2xl transition-all"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                "Acceder al Sistema"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
              © 2026 Sindicato Único de Trabajadores <br/>
              <span className="text-gray-600">Ciudad Benito Juárez, N.L.</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
