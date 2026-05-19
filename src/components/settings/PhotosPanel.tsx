'use client';

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, Upload, Search, RefreshCw, AlertCircle, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoItem {
  name: string;
  url: string;
  size: number;
  updatedAt: string;
}

export const PhotosPanel: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Form fields
  const [employeeId, setEmployeeId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchPhotos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/photos');
      if (!res.ok) throw new Error('Error al listar las fotografías.');
      const data = await res.json();
      setPhotos(data);
    } catch (error: any) {
      console.error(error);
      toast.error('No se pudieron cargar las fotos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast.error('El archivo debe ser una imagen.');
        return;
      }
      setSelectedFile(file);
      
      // Auto-extract numbers from filename to pre-populate employee ID if empty
      const match = file.name.match(/^(\d+)/);
      if (match && !employeeId) {
        setEmployeeId(match[1]);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Por favor, selecciona una fotografía.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (employeeId) {
      formData.append('employeeId', employeeId);
    }

    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al subir la fotografía.');
      }

      toast.success('Fotografía subida y sincronizada exitosamente.');
      setEmployeeId('');
      setSelectedFile(null);
      
      // Reset input element
      const fileInput = document.getElementById('photo-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchPhotos();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al subir fotografía.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la fotografía "${name}"? Esta acción se sincronizará con Supabase.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/photos?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Error al eliminar la fotografía.');

      toast.success('Fotografía eliminada con éxito.');
      setPhotos(prev => prev.filter(p => p.name !== name));
    } catch (error: any) {
      console.error(error);
      toast.error('No se pudo eliminar la fotografía.');
    }
  };

  const filteredPhotos = photos.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Galería & Almacenamiento</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Gestiona de forma directa las fotografías sincronizadas en tiempo real con Supabase Storage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchPhotos}
            variant="outline"
            className="h-11 px-4 border-gray-200 hover:bg-gray-100 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left Side: Upload Form */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 uppercase text-sm tracking-wide">Carga Manual</h4>
              <p className="text-[10px] text-gray-400 font-medium">Asocia una foto a un número de nómina</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                No. Nómina (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. 1234"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-gray-100 bg-gray-50/50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all"
              />
              <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                Si colocas el No. de nómina, la foto se guardará con ese número y se vinculará de inmediato al perfil del agremiado en la base de datos.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Fotografía
              </label>
              <div className="relative group">
                <input
                  id="photo-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="photo-file-input"
                  className="flex flex-col items-center justify-center w-full h-36 px-4 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer bg-gray-50/30 hover:bg-gray-50 hover:border-blue-500/50 transition-all text-center"
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700 max-w-[200px] truncate">{selectedFile.name}</p>
                        <p className="text-[9px] text-gray-400">{formatSize(selectedFile.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto group-hover:scale-105 transition-all">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-600">Seleccionar Imagen</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">JPEG, PNG o WEBP</p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all mt-6"
              disabled={isUploading || !selectedFile}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Subir Fotografía
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Right Side: Photo List Grid */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
          {/* Search bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de archivo o número de empleado..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-gray-100 bg-gray-50/50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Photo list container */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-gray-50 border border-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-3xl bg-gray-50 text-gray-300 flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <p className="font-bold text-gray-500">No se encontraron fotografías</p>
                <p className="text-xs text-gray-400 mt-1">Sube una nueva foto o cambia tus términos de búsqueda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AnimatePresence>
                  {filteredPhotos.map(photo => (
                    <motion.div
                      key={photo.name}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="group relative aspect-[3/4] rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 shadow-sm flex flex-col justify-between"
                    >
                      {/* Photo Thumbnail */}
                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${photo.url})` }} />
                      
                      {/* Dark overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3.5" />

                      {/* Photo Info Banner on Hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-black/40 text-white transform translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-[10px] font-black truncate uppercase tracking-tight">{photo.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[8px] font-semibold text-gray-300">{formatSize(photo.size)}</span>
                          <span className="text-[8px] font-semibold text-gray-300">
                            {new Date(photo.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Top Bar on Hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                        <button
                          onClick={() => handleDelete(photo.name)}
                          className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-md shadow-red-600/30 hover:scale-105"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
