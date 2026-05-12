import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET() {
  try {
    const db = new Database(dbPath);
    const users = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role_id, u.is_active, u.last_login, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.full_name
    `).all();
    db.close();
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    const id = `user-${crypto.randomUUID().substring(0, 8)}`;
    
    // Check duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) {
      db.close();
      return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 400 });
    }
    
    const plainPassword = data.password || 'changeme';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    db.prepare(`INSERT INTO users (id, full_name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, data.full_name, data.email, hashedPassword, data.role_id, data.is_active ? 1 : 0
    );
    
    db.close();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
      db.prepare('UPDATE users SET full_name=?, email=?, password_hash=?, role_id=?, is_active=? WHERE id=?').run(
        data.full_name, data.email, hashedPassword, data.role_id, data.is_active ? 1 : 0, data.id
      );
    } else {
      db.prepare('UPDATE users SET full_name=?, email=?, role_id=?, is_active=? WHERE id=?').run(
        data.full_name, data.email, data.role_id, data.is_active ? 1 : 0, data.id
      );
    }
    
    db.close();
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
    
    const db = new Database(dbPath);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
