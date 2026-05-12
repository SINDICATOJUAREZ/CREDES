'use client';

import React from 'react';
import { Member } from '@/types/member';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface MemberTableProps {
  members: Member[];
  onView: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
}

export const MemberTable: React.FC<MemberTableProps> = ({ members, onView, onEdit, onDelete }) => {
  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="rounded-[2rem] border border-gray-100 bg-white overflow-auto shadow-xl shadow-gray-200/50 flex-1">
        <Table>
          <TableHeader className="bg-gray-50/80 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b border-gray-100">
              <TableHead className="w-[60px] px-4"></TableHead>
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4">Nómina</TableHead>
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4">Nombre Completo</TableHead>
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4">Puesto</TableHead>
              <TableHead className="font-black text-blue-900 uppercase text-[10px] tracking-widest px-3 py-4">Departamento</TableHead>
              <TableHead className="text-right font-black text-blue-900 uppercase text-[10px] tracking-widest px-6 py-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length > 0 ? (
              members.map((member) => (
                <TableRow 
                  key={member.id} 
                  className="hover:bg-blue-50/50 transition-all border-b border-gray-50 cursor-pointer group"
                  onClick={() => onEdit(member)}
                >
                  <TableCell className="py-5 px-6">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-200 group-hover:border-blue-500 group-hover:bg-blue-50 flex items-center justify-center transition-all">
                      <div className="w-2 h-2 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-all"></div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="font-mono text-xs font-black px-2 py-1 bg-gray-100 text-gray-600 rounded-md border border-gray-200">
                      {member.employeeId}
                    </span>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{member.fullName}</span>
                      <div className="flex gap-2 mt-1">
                        {member.memberType === 'SECRETARIO_GENERAL' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                            Secretario General
                          </span>
                        )}
                        {member.memberType === 'DELEGADO' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                            Delegado
                          </span>
                        )}
                        {member.memberType === 'ACTIVO' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                            Agremiado
                          </span>
                        )}
                        {member.memberType === 'ESPERA' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                            Lista de Espera
                          </span>
                        )}
                        {member.memberType === 'PENSIONADO' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                            Pensionado
                          </span>
                        )}
                        {member.memberType === 'BAJA' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                            Baja
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <span className="text-gray-600 text-sm font-medium">{member.position}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <span className="text-gray-500 text-sm font-medium italic">{member.department}</span>
                  </TableCell>
                  <TableCell className="py-5 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold gap-2" onClick={() => onView(member)}>
                        <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Ver</span>
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-gray-200 hover:bg-gray-50 transition-all font-bold" onClick={() => onEdit(member)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-red-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all font-bold" onClick={() => onDelete(member.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
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
