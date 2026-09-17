import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { DELEGATE_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';
import { isProduction, sSelect, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth-utils';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    if (isProduction) {
      const delegates = await sSelect('delegates', 'order=full_name.asc');
      return NextResponse.json(delegates.map((d: any) => mapToFrontend(d, DELEGATE_MAPPING)));
    }
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));
    const delegates = db.prepare('SELECT * FROM delegates ORDER BY full_name ASC').all();
    db.close();
    return NextResponse.json(delegates.map((d: any) => mapToFrontend(d, DELEGATE_MAPPING)));
  } catch (error: any) {
    console.error('Delegates API Error:', error);
    return NextResponse.json({ error: 'Error al consultar delegados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await hasPermission('canCreateMember') && !await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const id = data.id || crypto.randomUUID();
    data.id = id;

    if (isProduction) {
      const dbData: any = { id };
      for (const [dbKey, fsKey] of Object.entries(DELEGATE_MAPPING)) {
        if (data[fsKey as string] !== undefined) dbData[dbKey] = data[fsKey as string];
      }
      await sInsert('delegates', dbData);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const { sql, params } = generateInsert('delegates', DELEGATE_MAPPING, data);
      db.prepare(sql).run(...params);
      db.close();
    }
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Delegates POST Error:', error);
    return NextResponse.json({ error: 'Error al registrar delegado' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await hasPermission('canCreateMember') && !await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await request.json();
    if (!data.id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(data.id);

    if (isProduction) {
      const { id, ...rest } = data;
      const dbData: any = {};
      for (const [dbKey, fsKey] of Object.entries(DELEGATE_MAPPING)) {
        if (rest[fsKey as string] !== undefined) dbData[dbKey] = rest[fsKey as string];
      }
      await sUpdate('delegates', `id=eq.${safeId}`, dbData);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const { sql, params } = generateUpdate('delegates', DELEGATE_MAPPING, data);
      db.prepare(sql).run(...params);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delegates PUT Error:', error);
    return NextResponse.json({ error: 'Error al actualizar delegado' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await hasPermission('canCreateMember') && !await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(id);

    if (isProduction) {
      const linked = await sSelect('members', `select=id&delegate_id=eq.${safeId}&limit=1`);
      if (linked.length > 0) {
        return NextResponse.json({ error: 'No se puede eliminar: hay agremiados vinculados a este delegado.' }, { status: 400 });
      }
      await sDelete('delegates', `id=eq.${safeId}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const linked = db.prepare('SELECT COUNT(*) as count FROM members WHERE delegate_id = ?').get(id) as any;
      if (linked.count > 0) {
        db.close();
        return NextResponse.json({ error: `No se puede eliminar: hay ${linked.count} agremiados vinculados a este delegado.` }, { status: 400 });
      }
      db.prepare('DELETE FROM delegates WHERE id = ?').run(id);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delegates DELETE Error:', error);
    return NextResponse.json({ error: 'Error al eliminar delegado' }, { status: 500 });
  }
}
