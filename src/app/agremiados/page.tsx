'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Member } from '@/types/member';
import { MemberTable } from '@/components/members/MemberTable';
import { MemberForm } from '@/components/members/MemberForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateResumePDF } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { Search, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgremiadosPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data, error, mutate } = useSWR(
    `/api/members?page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher
  );

  const members = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 1 };
  const isLoading = !data && !error;

  const handleFormSubmit = async (formData: Member) => {
    try {
      const method = editingMember ? 'PUT' : 'POST';
      const response = await fetch('/api/members', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      toast.success(editingMember ? 'Agremiado actualizado' : 'Agremiado registrado');
      mutate(); // Refresh current page
      setIsFormOpen(false);
      setEditingMember(undefined);
    } catch (err) {
      toast.error('Error al guardar los cambios');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    try {
      const response = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      toast.success('Agremiado eliminado');
      mutate();
    } catch (err) {
      toast.error('Error al eliminar el registro');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-black text-blue-900 flex items-center gap-2 uppercase tracking-tight">
            <Search className="w-6 h-6 text-blue-600" />
            Directorio de Agremiados
          </h1>
        </div>
        <Button 
          onClick={() => { setEditingMember(undefined); setIsFormOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 rounded-full font-bold px-6"
        >
          NUEVO AGREMIADO
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col max-w-7xl mx-auto w-full gap-6">
        {/* Search Bar */}
        <div className="relative group bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 flex items-center">
          <Search className="absolute left-6 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <Input 
            placeholder="Buscar por nombre, nómina, departamento..." 
            className="pl-12 border-none shadow-none focus-visible:ring-0 text-lg h-12 rounded-[1.5rem]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table Area */}
        <div className="bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/40 flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <MemberTable 
              members={members} 
              onView={(m) => generateResumePDF(m)} 
              onEdit={(m) => { setEditingMember(m); setIsFormOpen(true); }} 
              onDelete={handleDeleteMember}
            />
          )}

          {/* Pagination */}
          <div className="border-t border-gray-100 p-4 flex items-center justify-between bg-gray-50/50">
            <span className="text-sm text-gray-500 font-medium">
              Mostrando {members.length} de {meta.total} registros
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold w-20 text-center text-blue-900">
                Pág {page} / {meta.totalPages}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1150px] max-h-[95vh] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <MemberForm initialData={editingMember} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
