'use client';

import React, { useState, useEffect } from 'react';
import { Role, SystemUser, CredentialDesign, DbVisualElement } from '@/types/member';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Save, X, Users as UsersIcon, ChevronRight, Shield, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================
// USERS TAB
// =============================================
export const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const emptyUser: SystemUser = { id: '', full_name: '', email: '', role_id: '', is_active: true };

  const fetchData = async () => {
    const [uRes, rRes] = await Promise.all([fetch('/api/settings/users'), fetch('/api/settings/roles')]);
    setUsers(await uRes.json());
    setRoles(await rRes.json());
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (user: SystemUser) => {
    const method = isCreating ? 'POST' : 'PUT';
    const res = await fetch('/api/settings/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
    const result = await res.json();
    if (result.error) { toast.error(result.error); return; }
    toast.success(isCreating ? 'Usuario creado' : 'Usuario actualizado');
    setEditingUser(null);
    setIsCreating(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await fetch(`/api/settings/users?id=${id}`, { method: 'DELETE' });
    toast.success('Usuario eliminado');
    fetchData();
  };

  if (editingUser) {
    return <UserForm user={editingUser} roles={roles} onSave={handleSave} onCancel={() => { setEditingUser(null); setIsCreating(false); }} isCreating={isCreating} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Usuarios del Sistema</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">{users.length} usuarios registrados</p>
        </div>
        <Button onClick={() => { setEditingUser(emptyUser); setIsCreating(true); }} className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl gap-2">
          <Plus className="w-5 h-5" /> Nuevo Usuario
        </Button>
      </div>
      <div className="space-y-3">
        {users.map(u => (
          <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer"
            onClick={() => { setEditingUser(u); setIsCreating(false); }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg ${u.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                {u.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-black text-gray-800 uppercase text-sm">{u.full_name}</p>
                <p className="text-xs text-gray-400 font-medium">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${u.role_name === 'MASTER' ? 'bg-red-100 text-red-700' : u.role_name === 'ADMINISTRADOR' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {u.role_name || 'Sin rol'}
              </span>
              <span className={`w-3 h-3 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const UserForm: React.FC<{ user: SystemUser; roles: Role[]; onSave: (u: SystemUser) => void; onCancel: () => void; isCreating: boolean }> = ({ user, roles, onSave, onCancel, isCreating }) => {
  const [form, setForm] = useState<SystemUser>(user);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-lg">
      <Button variant="ghost" onClick={onCancel} className="mb-6 text-gray-400 hover:text-gray-800 font-bold gap-2">
        <X className="w-4 h-4" /> Volver a la lista
      </Button>
      <h3 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tight">{isCreating ? 'Nuevo Usuario' : 'Editar Usuario'}</h3>
      <div className="space-y-5">
        <div><Label className="text-xs font-bold uppercase text-gray-400">Nombre Completo</Label>
          <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="h-12 rounded-xl mt-1" /></div>
        <div><Label className="text-xs font-bold uppercase text-gray-400">Correo Electrónico</Label>
          <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl mt-1" /></div>
        {isCreating && (
          <div><Label className="text-xs font-bold uppercase text-gray-400">Contraseña</Label>
            <Input type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} className="h-12 rounded-xl mt-1" placeholder="Mínimo 6 caracteres" /></div>
        )}
        <div><Label className="text-xs font-bold uppercase text-gray-400">Rol Asignado</Label>
          <Select value={form.role_id} onValueChange={v => setForm({ ...form, role_id: v as string })}>
            <SelectTrigger className="h-12 rounded-xl mt-1"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
            <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <Label className="text-sm font-bold">Usuario Activo</Label>
        </div>
        <div className="flex gap-3 pt-4">
          <Button onClick={() => onSave(form)} className="flex-1 h-12 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl gap-2">
            <Save className="w-4 h-4" /> Guardar
          </Button>
          <Button variant="outline" onClick={onCancel} className="h-12 px-6 rounded-xl font-bold">Cancelar</Button>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================
// ROLES TAB
// =============================================
const PERMISSION_LABELS: Record<string, string> = {
  can_create_member: 'Crear Agremiado',
  can_search_member: 'Buscar Agremiado',
  can_view_reports: 'Reportes de Asistencia',
  can_view_pensioners: 'Futuros Pensionados',
  can_access_settings: 'Configuración',
};

export const RolesPanel: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const emptyRole: Role = { id: '', name: '', description: '', can_create_member: false, can_search_member: false, can_view_reports: false, can_view_pensioners: false, can_access_settings: false };

  const fetchRoles = async () => {
    const res = await fetch('/api/settings/roles');
    setRoles(await res.json());
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleSave = async (role: Role) => {
    const method = isCreating ? 'POST' : 'PUT';
    const res = await fetch('/api/settings/roles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(role) });
    const result = await res.json();
    if (result.error) { toast.error(result.error); return; }
    toast.success(isCreating ? 'Rol creado' : 'Rol actualizado');
    setEditingRole(null);
    setIsCreating(false);
    fetchRoles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este rol?')) return;
    const res = await fetch(`/api/settings/roles?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.error) { toast.error(result.error); return; }
    toast.success('Rol eliminado');
    fetchRoles();
  };

  if (editingRole) {
    return <RoleForm role={editingRole} onSave={handleSave} onCancel={() => { setEditingRole(null); setIsCreating(false); }} onDelete={!isCreating ? () => handleDelete(editingRole.id) : undefined} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Roles y Permisos (RBAC)</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">Defina los niveles de acceso al sistema</p>
        </div>
        <Button onClick={() => { setEditingRole(emptyRole); setIsCreating(true); }} className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl gap-2">
          <Plus className="w-5 h-5" /> Nuevo Rol
        </Button>
      </div>
      <div className="space-y-3">
        {roles.map(r => (
          <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer"
            onClick={() => { setEditingRole(r); setIsCreating(false); }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${r.name === 'MASTER' ? 'bg-red-600 text-white' : r.name === 'ADMINISTRADOR' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-gray-800 uppercase text-sm">{r.name}</p>
                <p className="text-xs text-gray-400 font-medium">{r.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><UsersIcon className="w-4 h-4" /> {r.userCount} usuarios</span>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const RoleForm: React.FC<{ role: Role; onSave: (r: Role) => void; onCancel: () => void; onDelete?: () => void }> = ({ role, onSave, onCancel, onDelete }) => {
  const [form, setForm] = useState<Role>(role);

  const togglePerm = (key: string) => setForm({ ...form, [key]: !(form as any)[key] });

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-lg">
      <Button variant="ghost" onClick={onCancel} className="mb-6 text-gray-400 hover:text-gray-800 font-bold gap-2">
        <X className="w-4 h-4" /> Volver
      </Button>
      <h3 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tight">{role.id ? 'Editar Rol' : 'Nuevo Rol'}</h3>
      <div className="space-y-5">
        <div><Label className="text-xs font-bold uppercase text-gray-400">Nombre del Rol</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} className="h-12 rounded-xl mt-1 font-bold" /></div>
        <div><Label className="text-xs font-bold uppercase text-gray-400">Descripción</Label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-12 rounded-xl mt-1" /></div>
        
        <div className="pt-2">
          <Label className="text-xs font-bold uppercase text-gray-400 mb-3 block">Permisos del Rol</Label>
          <div className="space-y-2">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <span className="text-sm font-bold text-gray-600">{label}</span>
                <Switch checked={(form as any)[key]} onCheckedChange={() => togglePerm(key)} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={() => onSave(form)} className="flex-1 h-12 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl gap-2">
            <Save className="w-4 h-4" /> Guardar
          </Button>
          {onDelete && (
            <Button variant="outline" onClick={onDelete} className="h-12 px-6 rounded-xl font-bold text-red-500 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
