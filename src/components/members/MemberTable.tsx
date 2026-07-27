'use client';

import React, { useState, useEffect } from 'react';
import { Member } from '@/types/member';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, Edit, Trash2, Filter, X, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface MemberTableProps {
  members: Member[];
  onView: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;

  // Extra filter props
  filterNomina: string;
  setFilterNomina: (val: string) => void;
  filterNombre: string;
  setFilterNombre: (val: string) => void;
  filterTipo: string;
  setFilterTipo: (val: string) => void;
  filterEstado: string;
  setFilterEstado: (val: string) => void;
  filterPuesto: string;
  setFilterPuesto: (val: string) => void;
  filterDepartamento: string;
  setFilterDepartamento: (val: string) => void;
}

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  filterNomina,
  setFilterNomina,
  filterNombre,
  setFilterNombre,
  filterTipo,
  setFilterTipo,
  filterEstado,
  setFilterEstado,
  filterPuesto,
  setFilterPuesto,
  filterDepartamento,
  setFilterDepartamento,
}) => {
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

  // Temporary local states for text filter inputs
  const [tempNomina, setTempNomina] = useState(filterNomina);
  const [tempNombre, setTempNombre] = useState(filterNombre);
  const [tempPuesto, setTempPuesto] = useState(filterPuesto);
  const [tempDepartamento, setTempDepartamento] = useState(filterDepartamento);

  // Keep temporary states in sync with props
  useEffect(() => {
    setTempNomina(filterNomina);
    setTempNombre(filterNombre);
    setTempPuesto(filterPuesto);
    setTempDepartamento(filterDepartamento);
  }, [filterNomina, filterNombre, filterPuesto, filterDepartamento]);

  // Click outside to close dropdowns
  useEffect(() => {
    if (!activeFilterDropdown) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.filter-dropdown-container') || target.closest('.filter-trigger-btn')) {
        return;
      }
      setActiveFilterDropdown(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeFilterDropdown]);

  const renderTextFilterDropdown = (
    columnId: string,
    title: string,
    value: string,
    tempValue: string,
    setTempValue: (val: string) => void,
    setFilterValue: (val: string) => void
  ) => {
    if (activeFilterDropdown !== columnId) return null;
    return (
      <div 
        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50 w-64 text-slate-800 normal-case font-medium animate-in fade-in slide-in-from-top-2 duration-150 filter-dropdown-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 border-b border-gray-150 pb-2">
          <h4 className="font-black text-xs uppercase tracking-wider text-blue-900">{title}</h4>
          <button onClick={() => setActiveFilterDropdown(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input 
          type="text" 
          value={tempValue} 
          onChange={(e) => setTempValue(e.target.value)} 
          className="w-full h-9 border border-gray-200 rounded-xl px-3 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
          placeholder="Buscar..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setFilterValue(tempValue);
              setActiveFilterDropdown(null);
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-xs rounded-xl h-8 font-black uppercase text-gray-500 hover:text-gray-700" 
            onClick={() => { setFilterValue(''); setTempValue(''); setActiveFilterDropdown(null); }}
          >
            Limpiar
          </Button>
          <Button 
            size="sm" 
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl h-8 font-black uppercase shadow-md shadow-blue-100" 
            onClick={() => { setFilterValue(tempValue); setActiveFilterDropdown(null); }}
          >
            Aplicar
          </Button>
        </div>
      </div>
    );
  };

  const renderSelectFilterDropdown = (
    columnId: string,
    title: string,
    currentValue: string,
    options: { value: string; label: string }[],
    setFilterValue: (val: string) => void
  ) => {
    if (activeFilterDropdown !== columnId) return null;
    return (
      <div 
        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-50 w-56 text-slate-800 normal-case font-medium animate-in fade-in slide-in-from-top-2 duration-150 filter-dropdown-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-150 mb-1">
          <h4 className="font-black text-xs uppercase tracking-wider text-blue-900">{title}</h4>
          <button onClick={() => setActiveFilterDropdown(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setFilterValue(opt.value);
                  setActiveFilterDropdown(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  isSelected 
                    ? 'bg-blue-50 text-blue-700 font-extrabold' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 h-full flex flex-col relative overflow-visible">
      <div className="rounded-[2rem] border border-gray-100 bg-white overflow-auto shadow-xl shadow-gray-200/50 flex-1 relative z-10">
        <Table>
          <TableHeader className="bg-gray-50/80 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b border-gray-100">
              <TableHead className="w-[80px] font-black text-blue-900 uppercase text-[10px] tracking-widest px-4 py-4">Foto</TableHead>
              
              {/* Nómina Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Nómina</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'nomina' ? null : 'nomina'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterNomina ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderTextFilterDropdown('nomina', 'Nómina', filterNomina, tempNomina, setTempNomina, setFilterNomina)}
              </TableHead>

              {/* Nombre Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Nombre Completo</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'nombre' ? null : 'nombre'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterNombre ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderTextFilterDropdown('nombre', 'Nombre', filterNombre, tempNombre, setTempNombre, setFilterNombre)}
              </TableHead>

              {/* Tipo de Agremiado Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Tipo de Agremiado</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'tipo' ? null : 'tipo'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterTipo ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderSelectFilterDropdown('tipo', 'Tipo de Agremiado', filterTipo, [
                  { value: '', label: 'Todos' },
                  { value: 'AGREMIADO', label: 'Agremiado' },
                  { value: 'DELEGADO', label: 'Delegado' },
                  { value: 'SECRETARIO GENERAL', label: 'Secretario General' },
                  { value: 'LISTA DE ESPERA', label: 'Lista de Espera' },
                ], setFilterTipo)}
              </TableHead>

              {/* Estado Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Estado</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'estado' ? null : 'estado'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterEstado ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderSelectFilterDropdown('estado', 'Estado', filterEstado, [
                  { value: '', label: 'Todos' },
                  { value: 'ACTIVO', label: 'Activo' },
                  { value: 'BAJA', label: 'Baja' },
                  { value: 'INCAPACITADO', label: 'Incapacitado' },
                  { value: 'JUBILADO/PENSIONADO', label: 'Jubilado/Pensionado' },
                  { value: 'FINADO', label: 'Finado' },
                  { value: 'N/A', label: 'N/A' },
                  { value: 'PENSIONADO', label: 'Pensionado' },
                ], setFilterEstado)}
              </TableHead>

              {/* Puesto Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Puesto</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'puesto' ? null : 'puesto'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterPuesto ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderTextFilterDropdown('puesto', 'Puesto', filterPuesto, tempPuesto, setTempPuesto, setFilterPuesto)}
              </TableHead>

              {/* Departamento Column Header */}
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4 relative overflow-visible">
                <div className="flex items-center gap-2">
                  <span>Departamento</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(activeFilterDropdown === 'departamento' ? null : 'departamento'); }}
                    className={`filter-trigger-btn p-1 rounded-md hover:bg-gray-200 transition-colors ${filterDepartamento ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderTextFilterDropdown('departamento', 'Departamento', filterDepartamento, tempDepartamento, setTempDepartamento, setFilterDepartamento)}
              </TableHead>

              <TableHead className="text-right font-black text-blue-900 uppercase text-[10px] tracking-widest px-6 py-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length > 0 ? (
              members.map((member) => (
                <TableRow 
                  key={member.id} 
                  className="hover:bg-blue-50/50 transition-all border-b border-gray-50 cursor-pointer group"
                  onClick={() => canEdit ? onEdit(member) : onView(member)}
                >
                  <TableCell className="py-3 px-4">
                    {member.photoUrl ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all">
                        <img src={`${member.photoUrl}?t=${new Date().getTime()}`} alt={member.fullName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center text-xs font-black uppercase shadow-inner group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        {member.fullName.charAt(0)}
                      </div>
                    )}
                  </TableCell>
                  
                  {/* Nómina */}
                  <TableCell className="py-4">
                    <span className="font-mono text-xs font-black px-2 py-1 bg-gray-100 text-gray-600 rounded-md border border-gray-200">
                      {member.employeeId}
                    </span>
                  </TableCell>
                  
                  {/* Nombre Completo */}
                  <TableCell className="py-5 px-4">
                    <span className="font-bold text-gray-900">{member.fullName}</span>
                  </TableCell>

                  {/* Tipo de Agremiado */}
                  <TableCell className="py-5 px-4">
                    {member.memberType === 'SECRETARIO GENERAL' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                        Secretario General
                      </span>
                    )}
                    {member.memberType === 'DELEGADO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                        Delegado
                      </span>
                    )}
                    {member.memberType === 'LISTA DE ESPERA' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                        Lista de Espera
                      </span>
                    )}
                    {member.memberType === 'AGREMIADO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                        Agremiado
                      </span>
                    )}
                  </TableCell>

                  {/* Estado */}
                  <TableCell className="py-5 px-4">
                    {member.status === 'BAJA' && (() => {
                      const today = new Date();
                      const parseDate = (dStr: any) => {
                        if (!dStr) return null;
                        const d = new Date(dStr);
                        return isNaN(d.getTime()) ? null : d;
                      };
                      const jDate = parseDate(member.joinDate);
                      const bDate = parseDate(member.birthDate);
                      let years = jDate ? today.getFullYear() - jDate.getFullYear() : 0;
                      let age = bDate ? today.getFullYear() - bDate.getFullYear() : 0;
                      const isPensioned = (age > 50 && years >= 15);
                      return isPensioned ? (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                          Pensionado
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                          Baja
                        </span>
                      );
                    })()}
                    {member.status === 'ACTIVO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                        Activo
                      </span>
                    )}
                    {member.status === 'JUBILADO/PENSIONADO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                        Jubilado/Pensionado
                      </span>
                    )}
                    {member.status === 'FINADO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                        Finado
                      </span>
                    )}
                    {member.status === 'INCAPACITADO' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                        Incapacitado
                      </span>
                    )}
                    {member.status === 'N/A' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                        N/A
                      </span>
                    )}
                  </TableCell>

                  {/* Puesto */}
                  <TableCell className="py-5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <span className="text-gray-600 text-sm font-medium">{member.position}</span>
                    </div>
                  </TableCell>

                  {/* Departamento */}
                  <TableCell className="py-5 px-4">
                    <span className="text-gray-500 text-sm font-medium italic">{member.department}</span>
                  </TableCell>

                  <TableCell className="py-5 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold gap-2" onClick={(e) => { e.stopPropagation(); onView(member); }}>
                        <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Ver</span>
                      </Button>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-gray-200 hover:bg-gray-50 transition-all font-bold" onClick={(e) => { e.stopPropagation(); onEdit(member); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-red-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all font-bold" onClick={(e) => { e.stopPropagation(); onDelete(member.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>No se encontraron agremiados que coincidan con la búsqueda.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
