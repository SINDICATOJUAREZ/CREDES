'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Member, Delegate } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users, Briefcase, User, Phone, DollarSign, Star, Award, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCredentialConfig } from '@/hooks/useCredentialConfig';
import { CredentialCard } from '@/components/credential/CredentialCard';
import { generateCredentialPDF, generateVectorialCredentialPDF } from '@/lib/pdf-generator';
import { PhotoUploadDialog } from './PhotoUploadDialog';

interface MemberFormProps {
  initialData?: Member;
  onSubmit: (data: Member) => void;
  onCancel: () => void;
}

export const MemberForm: React.FC<MemberFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const { config } = useCredentialConfig();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  
  const { register, control, handleSubmit, reset, watch, setValue, getValues } = useForm<Member>({
    defaultValues: initialData || {
      fullName: '',
      memberType: 'ACTIVO',
      status: 'ACTIVO',
      position: '',
      department: '',
      secretariat: '',
      employeeId: '',
      socioId: '',
      curp: '',
      rfc: '',
      phone: '',
      address: '',
      email: '',
      bloodType: '',
      gender: 'M',
      education: '',
      delegate: '',
      birthDate: '',
      birthPlace: '',
      maritalStatus: '',
      colonia: '',
      municipio: '',
      cp: '',
      emergencyContact: '',
      emergencyPhone: '',
      emergencyRelationship: '',
      clinic: '',
      salary: 0,
      bonos: 0,
      bonoAsistencia: 0,
      joinDate: new Date().toISOString().split('T')[0],
      altaSindicato: '',
      fechaBaja: '',
      family: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "family"
  });

  useEffect(() => {
    const fetchDelegates = async () => {
      try {
        const response = await fetch('/api/delegates');
        const data = await response.json();
        console.log('Fetched delegates:', data);
        setDelegates(data);
      } catch (error) {
        console.error('Error fetching delegates:', error);
      }
    };
    fetchDelegates();
  }, []);

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset, delegates]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-[780px] w-[1100px] max-w-full">
      <Tabs defaultValue="personal" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-10 pt-8 pb-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-3xl font-black text-blue-900 tracking-tight uppercase">
                {initialData ? 'Editar Expediente de Agremiado' : 'Registro de Nuevo Agremiado'}
              </h2>
              <p className="text-gray-500 font-medium mt-1">Gestión Integral de Información Sindical SUTSMBJ</p>
            </div>
            <div className="flex gap-3 mb-1">
               <div className="px-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de Datos 2026</span>
               </div>
            </div>
          </div>
          
          <TabsList className="flex w-full bg-white p-1 rounded-2xl border border-gray-200 h-14">
            <TabsTrigger value="personal" className="flex-1 font-black py-3 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex gap-3 items-center uppercase text-xs tracking-widest">
              <User className="w-5 h-5" /> Datos Personales
            </TabsTrigger>
            <TabsTrigger value="laboral" className="flex-1 font-black py-3 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex gap-3 items-center uppercase text-xs tracking-widest">
              <Briefcase className="w-5 h-5" /> Información Laboral
            </TabsTrigger>
            <TabsTrigger value="contacto" className="flex-1 font-black py-3 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex gap-3 items-center uppercase text-xs tracking-widest">
              <Phone className="w-5 h-5" /> Contacto y Emergencia
            </TabsTrigger>
            <TabsTrigger value="family" className="flex-1 font-black py-3 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex gap-3 items-center uppercase text-xs tracking-widest">
              <Users className="w-5 h-5" /> Grupo Familiar
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8 bg-white">
          <TabsContent value="personal" className="space-y-8 mt-0 outline-none animate-in fade-in duration-500">
            <div className="flex gap-10">
              {/* Photo Section */}
              <div className="w-64 flex flex-col items-center gap-4">
                <div className="w-64 h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] overflow-hidden flex items-center justify-center relative group">
                  {watch('photoUrl') ? (
                    <img 
                      src={watch('photoUrl')} 
                      alt="Foto del agremiado" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-300 group-hover:text-blue-400 transition-colors">
                      <User className="w-20 h-20 opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Sin Fotografía</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsPhotoDialogOpen(true)}
                      className="text-white font-black uppercase tracking-widest text-[10px] bg-white/20 backdrop-blur-md rounded-xl"
                    >
                      Cambiar Foto
                    </Button>
                  </div>
                </div>
              </div>

              {/* Form Fields Section */}
              <div className="flex-1 grid grid-cols-2 gap-8">
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Nombre Completo (como aparece en nómina)</Label>
                  <Input {...register('fullName', { required: true })} placeholder="Nombre y Apellidos" className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-gray-800 text-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">CURP</Label>
                  <Input {...register('curp')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl uppercase font-mono tracking-widest" maxLength={18} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">RFC</Label>
                  <Input {...register('rfc')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl uppercase font-mono tracking-widest" maxLength={13} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Género</Label>
                  <select {...register('gender')} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="M">MASCULINO</option>
                    <option value="F">FEMENINO</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Estado Civil</Label>
                  <Input {...register('maritalStatus')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Escolaridad</Label>
                  <Input {...register('education')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Tipo de Sangre</Label>
                  <Input {...register('bloodType')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Fecha de Nacimiento</Label>
                  <Input type="date" {...register('birthDate')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Lugar de Nacimiento</Label>
                  <Input {...register('birthPlace')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Nombre del Cónyuge</Label>
                  <Input {...register('spouseName')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="laboral" className="space-y-8 mt-0 outline-none animate-in fade-in duration-500">
            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Número de Nómina</Label>
                <Input {...register('employeeId')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50/30" placeholder="Ej. 12345" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Número de Socio</Label>
                <Input {...register('socioId')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50/30" placeholder="Ej. S-900" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Estado</Label>
                <select {...register('status')} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="BAJA">BAJA</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Puesto / Cargo Oficial</Label>
                <Input {...register('position')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Tipo de Miembro</Label>
                <select {...register('memberType')} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ACTIVO">Agremiado</option>
                  <option value="DELEGADO">Delegado</option>
                  <option value="SECRETARIO_GENERAL">Secretario General</option>
                  <option value="ESPERA">Lista de espera</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Dirección (Área)</Label>
                <Input {...register('department')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Secretaría</Label>
                <Input {...register('secretariat')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Delegado Asignado</Label>
                <select {...register('delegate')} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccione un delegado...</option>
                  {/* Ensure current delegate is an option even if not in the catalog */}
                  {watch('delegate') && !delegates.some(d => d.fullName === watch('delegate')) && (
                    <option value={watch('delegate')}>{watch('delegate')} (No en catálogo)</option>
                  )}
                  {delegates.map(d => (
                    <option key={d.id} value={d.fullName}>{d.fullName} ({d.department})</option>
                  ))}
                </select>
              </div>
              
              {/* SALARY & BONUSES SECTION */}
              <div className="col-span-3 grid grid-cols-3 gap-8 mt-4 p-6 bg-blue-50/30 rounded-[2rem] border border-blue-100/50">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Sueldo Mensual (Base)
                  </Label>
                  <Input type="number" step="0.01" {...register('salary')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-blue-600 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                    <Star className="w-4 h-4" /> Bonos
                  </Label>
                  <Input type="number" step="0.01" {...register('bonos')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-amber-600 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                    <Award className="w-4 h-4" /> Puntualidad y Asistencia
                  </Label>
                  <Input type="number" step="0.01" {...register('bonoAsistencia')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-green-600 bg-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Ingreso Municipio</Label>
                <Input type="date" {...register('joinDate')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Alta Sindicato</Label>
                <Input type="date" {...register('altaSindicato')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl bg-gray-50/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-red-600 uppercase tracking-widest">Fecha de Baja</Label>
                <Input type="date" {...register('fechaBaja')} className="h-12 border-gray-200 focus:ring-2 focus:ring-red-500 rounded-xl bg-gray-50/30" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contacto" className="space-y-8 mt-0 outline-none animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Celular / Teléfono</Label>
                <Input {...register('phone')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Correo Electrónico Personal</Label>
                <Input type="email" {...register('email')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Domicilio Actual (Calle, Número Ext/Int)</Label>
                <Input {...register('address')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Colonia / Sector</Label>
                <Input {...register('colonia')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Código Postal (C.P.)</Label>
                <Input {...register('cp')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-mono tracking-widest" maxLength={5} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-blue-900 uppercase tracking-widest">Municipio / Localidad</Label>
                <Input {...register('municipio')} className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-xl" />
              </div>
              
              <div className="col-span-2 mt-6 p-8 bg-blue-900/5 rounded-[2rem] border border-blue-900/10 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                  <Label className="text-sm font-black text-red-600 uppercase tracking-widest">Protocolo de Emergencia</Label>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2 col-span-1">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Contacto</Label>
                    <Input {...register('emergencyContact')} className="h-11 border-gray-200 focus:ring-2 focus:ring-red-500 rounded-xl bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono Directo</Label>
                    <Input {...register('emergencyPhone')} className="h-11 border-gray-200 focus:ring-2 focus:ring-red-500 rounded-xl bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parentesco / Relación</Label>
                    <Input {...register('emergencyRelationship')} className="h-11 border-gray-200 focus:ring-2 focus:ring-red-500 rounded-xl bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="family" className="space-y-8 mt-0 outline-none animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h4 className="text-xl font-black text-blue-900 flex items-center gap-3 uppercase tracking-tight">
                  <Users className="w-6 h-6 text-blue-600" /> Registro de Familiares y Beneficiarios
                </h4>
                <p className="text-xs text-gray-500 font-medium italic mt-1">Gestión de dependientes económicos para prestaciones sindicales</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="lg" 
                onClick={() => append({ id: crypto.randomUUID(), fullName: '', relationship: '', isDependent: true })}
                className="gap-3 border-blue-200 text-blue-600 hover:bg-blue-50 font-black rounded-2xl shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> Añadir Nuevo Familiar
              </Button>
            </div>

            <div className="space-y-4 pr-2 max-h-[400px] overflow-y-auto">
              {fields.map((field, index) => (
                <motion.div 
                  key={field.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-end gap-4 p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 group hover:border-blue-200 hover:bg-white transition-all shadow-sm"
                >
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre Completo</Label>
                    <Input {...register(`family.${index}.fullName` as const)} className="h-12 text-sm rounded-xl font-bold border-gray-200 group-hover:border-blue-100 bg-white" />
                  </div>
                  <div className="w-48 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Parentesco</Label>
                    <Input {...register(`family.${index}.relationship` as const)} className="h-12 text-sm rounded-xl border-gray-200 group-hover:border-blue-100 bg-white" />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Edad</Label>
                    <Input type="number" {...register(`family.${index}.age` as const)} className="h-12 text-sm rounded-xl border-gray-200 group-hover:border-blue-100 bg-white" />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => remove(index)}
                    className="text-red-300 hover:text-red-600 hover:bg-red-50 h-12 w-12 rounded-xl transition-all"
                  >
                    <Trash2 className="w-6 h-6" />
                  </Button>
                </motion.div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-24 text-gray-300 border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/30">
                  <Users className="w-20 h-20 mx-auto mb-6 opacity-10" />
                  <p className="text-base font-black uppercase tracking-widest opacity-40">No hay registros familiares</p>
                  <p className="text-sm italic mt-2 opacity-40">Haga clic en el botón para agregar un nuevo dependiente</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Hidden Credential for Printing */}
      <div className="fixed -left-[2000px] top-0">
        <CredentialCard 
          member={watch()} 
          config={config} 
          id="print-preview-form"
        />
      </div>

      <div className="flex justify-between items-center gap-5 px-10 py-8 bg-gray-50 border-t border-gray-100 rounded-b-[2.5rem]">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-gray-500 font-black uppercase tracking-widest hover:bg-white px-8 h-14 rounded-2xl">
          Descartar Cambios
        </Button>
        
        <div className="flex gap-4">
          {initialData && (
            <Button 
              type="button" 
              onClick={async () => {
                setIsPrinting(true);
                await generateVectorialCredentialPDF(watch(), config, `Credencial_${watch('fullName')}`);
                setIsPrinting(false);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 h-14 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs flex gap-2"
            >
              <Printer className="w-5 h-5" />
              Imprimir Credencial
            </Button>
          )}

          <Button 
            type="submit" 
            className="bg-blue-900 hover:bg-black text-white font-black px-10 h-14 rounded-2xl shadow-2xl shadow-blue-200 transition-all active:scale-95 uppercase tracking-widest text-sm"
          >
            {initialData ? 'Actualizar Expediente' : 'Finalizar y Guardar'}
          </Button>

          {!initialData && (
            <Button 
              type="button"
              onClick={async () => {
                // First save then print
                const data = getValues();
                setIsPrinting(true);
                await onSubmit(data); // This might close the form, so we print first or hope it stays
                await generateVectorialCredentialPDF(data, config, `Credencial_${data.fullName}`);
                setIsPrinting(false);
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-black px-8 h-14 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs flex gap-2"
            >
              <Printer className="w-5 h-5" />
              Guardar e Imprimir
            </Button>
          )}
        </div>
      </div>

      <PhotoUploadDialog 
        isOpen={isPhotoDialogOpen} 
        onClose={() => setIsPhotoDialogOpen(false)} 
        onPhotoCapture={(url) => setValue('photoUrl', url)} 
        currentPhoto={watch('photoUrl')}
      />
    </form>
  );
};
