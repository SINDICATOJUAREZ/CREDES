import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET() {
  try {
    const db = new Database(dbPath);
    const roles = db.prepare('SELECT * FROM roles ORDER BY name').all();
    const userCounts = db.prepare('SELECT role_id, COUNT(*) as count FROM users GROUP BY role_id').all() as any[];
    
    const rolesWithCounts = roles.map((r: any) => ({
      ...r,
      userCount: userCounts.find((uc: any) => uc.role_id === r.id)?.count || 0
    }));
    
    db.close();
    return NextResponse.json(rolesWithCounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    const id = `role-${crypto.randomUUID().substring(0, 8)}`;
    
    db.prepare(`INSERT INTO roles (id, name, description, can_create_member, can_search_member, can_view_reports, can_view_pensioners, can_access_settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, data.name, data.description,
      data.can_create_member ? 1 : 0, data.can_search_member ? 1 : 0,
      data.can_view_reports ? 1 : 0, data.can_view_pensioners ? 1 : 0,
      data.can_access_settings ? 1 : 0
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
    
    db.prepare(`UPDATE roles SET name=?, description=?, can_create_member=?, can_search_member=?, can_view_reports=?, can_view_pensioners=?, can_access_settings=? WHERE id=?`).run(
      data.name, data.description,
      data.can_create_member ? 1 : 0, data.can_search_member ? 1 : 0,
      data.can_view_reports ? 1 : 0, data.can_view_pensioners ? 1 : 0,
      data.can_access_settings ? 1 : 0,
      data.id
    );
    
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
    const usersWithRole = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(id) as any;
    if (usersWithRole.count > 0) {
      db.close();
      return NextResponse.json({ error: 'No se puede eliminar un rol con usuarios asignados' }, { status: 400 });
    }
    
    db.prepare('DELETE FROM roles WHERE id = ?').run(id);
    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
