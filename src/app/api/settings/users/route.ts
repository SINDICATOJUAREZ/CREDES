import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { isProduction, sSelect, sSelectOne, sInsert, sUpdate, sDelete } from '@/lib/supabase';

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = `user-${crypto.randomUUID().substring(0, 8)}`;
    const plainPassword = data.password || 'changeme';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    if (isProduction) {
      const existing = await sSelectOne('users', `email=eq.${encodeURIComponent(data.email)}`);
      if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 400 });
      await sInsert('users', { id, full_name: data.full_name, email: data.email, password_hash: hashedPassword, role_id: data.role_id, is_active: data.is_active ? 1 : 0 });
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
      if (existing) { db.close(); return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 400 }); }
      db.prepare('INSERT INTO users (id, full_name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.full_name, data.email, hashedPassword, data.role_id, data.is_active ? 1 : 0);
      db.close();
    }
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    if (isProduction) {
      const updateData: any = { full_name: data.full_name, email: data.email, role_id: data.role_id, is_active: data.is_active ? 1 : 0 };
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password_hash = await bcrypt.hash(data.password, salt);
      }
      await sUpdate('users', `id=eq.${data.id}`, updateData);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.password, salt);
        db.prepare('UPDATE users SET full_name=?, email=?, password_hash=?, role_id=?, is_active=? WHERE id=?').run(data.full_name, data.email, hashedPassword, data.role_id, data.is_active ? 1 : 0, data.id);
      } else {
        db.prepare('UPDATE users SET full_name=?, email=?, role_id=?, is_active=? WHERE id=?').run(data.full_name, data.email, data.role_id, data.is_active ? 1 : 0, data.id);
      }
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');
    if (isProduction) {
      await sDelete('users', `id=eq.${id}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
