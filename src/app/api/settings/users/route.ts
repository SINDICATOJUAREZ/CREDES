import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { isProduction, sSelect, sSelectOne, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth-utils';

export async function GET() {
  if (!await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    if (isProduction) {
      const users = await sSelect('users', 'select=id,full_name,email,role_id,is_active,last_login,created_at,roles!role_id(name,description)&order=full_name');
      return NextResponse.json(users.map((u: any) => ({
        ...u, role_name: u.roles?.name, role_description: u.roles?.description, roles: undefined,
      })));
    }
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));
    const users = db.prepare(`SELECT u.id, u.full_name, u.email, u.role_id, u.is_active, u.last_login, u.created_at, r.name as role_name, r.description as role_description FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.full_name`).all();
    db.close();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Users GET Error:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const data = await request.json();
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const fullName = typeof data.full_name === 'string' ? data.full_name.trim() : '';

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Nombre y correo son obligatorios' }, { status: 400 });
    }

    const id = `user-${crypto.randomUUID().substring(0, 8)}`;
    const plainPassword = data.password ? String(data.password) : 'Sindicato2026!';
    if (plainPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    if (isProduction) {
      const existing = await sSelectOne('users', `email=eq.${encodeURIComponent(email)}`);
      if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 400 });
      await sInsert('users', { id, full_name: fullName, email, password_hash: hashedPassword, role_id: data.role_id, is_active: data.is_active ? 1 : 0 });
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) { db.close(); return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 400 }); }
      db.prepare('INSERT INTO users (id, full_name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)').run(id, fullName, email, hashedPassword, data.role_id, data.is_active ? 1 : 0);
      db.close();
    }
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Users POST Error:', error);
    return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const data = await request.json();
    if (!data.id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(data.id);

    if (isProduction) {
      const updateData: any = { full_name: data.full_name, email: data.email, role_id: data.role_id, is_active: data.is_active ? 1 : 0 };
      if (data.password) {
        if (String(data.password).length < 6) {
          return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }
        const salt = await bcrypt.genSalt(10);
        updateData.password_hash = await bcrypt.hash(String(data.password), salt);
      }
      await sUpdate('users', `id=eq.${safeId}`, updateData);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      if (data.password) {
        if (String(data.password).length < 6) {
          db.close();
          return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(String(data.password), salt);
        db.prepare('UPDATE users SET full_name=?, email=?, password_hash=?, role_id=?, is_active=? WHERE id=?').run(data.full_name, data.email, hashedPassword, data.role_id, data.is_active ? 1 : 0, data.id);
      } else {
        db.prepare('UPDATE users SET full_name=?, email=?, role_id=?, is_active=? WHERE id=?').run(data.full_name, data.email, data.role_id, data.is_active ? 1 : 0, data.id);
      }
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Users PUT Error:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(id);

    if (isProduction) {
      await sDelete('users', `id=eq.${safeId}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Users DELETE Error:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
