import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isProduction, sSelect, sInsert, sUpdate, sDelete } from '@/lib/supabase';

export async function GET() {
  try {
    if (isProduction) {
      const roles = await sSelect('roles', 'order=name');
      const users = await sSelect('users', 'select=role_id');
      const countMap: Record<string, number> = {};
      for (const u of users) { countMap[u.role_id] = (countMap[u.role_id] || 0) + 1; }
      return NextResponse.json(roles.map((r: any) => ({ ...r, userCount: countMap[r.id] || 0 })));
    }
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));
    const roles = db.prepare('SELECT * FROM roles ORDER BY name').all();
    const userCounts = db.prepare('SELECT role_id, COUNT(*) as count FROM users GROUP BY role_id').all() as any[];
    const rolesWithCounts = roles.map((r: any) => ({ ...r, userCount: userCounts.find((uc: any) => uc.role_id === r.id)?.count || 0 }));
    db.close();
    return NextResponse.json(rolesWithCounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = `role-${crypto.randomUUID().substring(0, 8)}`;
    if (isProduction) {
      await sInsert('roles', { id, name: data.name, description: data.description, can_create_member: data.can_create_member ? 1 : 0, can_search_member: data.can_search_member ? 1 : 0, can_view_reports: data.can_view_reports ? 1 : 0, can_view_pensioners: data.can_view_pensioners ? 1 : 0, can_access_settings: data.can_access_settings ? 1 : 0 });
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('INSERT INTO roles (id, name, description, can_create_member, can_search_member, can_view_reports, can_view_pensioners, can_access_settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.name, data.description, data.can_create_member ? 1 : 0, data.can_search_member ? 1 : 0, data.can_view_reports ? 1 : 0, data.can_view_pensioners ? 1 : 0, data.can_access_settings ? 1 : 0);
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
      await sUpdate('roles', `id=eq.${data.id}`, { name: data.name, description: data.description, can_create_member: data.can_create_member ? 1 : 0, can_search_member: data.can_search_member ? 1 : 0, can_view_reports: data.can_view_reports ? 1 : 0, can_view_pensioners: data.can_view_pensioners ? 1 : 0, can_access_settings: data.can_access_settings ? 1 : 0 });
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('UPDATE roles SET name=?, description=?, can_create_member=?, can_search_member=?, can_view_reports=?, can_view_pensioners=?, can_access_settings=? WHERE id=?').run(data.name, data.description, data.can_create_member ? 1 : 0, data.can_search_member ? 1 : 0, data.can_view_reports ? 1 : 0, data.can_view_pensioners ? 1 : 0, data.can_access_settings ? 1 : 0, data.id);
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
      const usersWithRole = await sSelect('users', `select=id&role_id=eq.${id}&limit=1`);
      if (usersWithRole.length > 0) return NextResponse.json({ error: 'No se puede eliminar un rol con usuarios asignados' }, { status: 400 });
      await sDelete('roles', `id=eq.${id}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const usersWithRole = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(id) as any;
      if (usersWithRole.count > 0) { db.close(); return NextResponse.json({ error: 'No se puede eliminar un rol con usuarios asignados' }, { status: 400 }); }
      db.prepare('DELETE FROM roles WHERE id = ?').run(id);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
