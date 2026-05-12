import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { DELEGATE_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET() {
  try {
    const db = new Database(dbPath);
    const delegates = db.prepare('SELECT * FROM delegates ORDER BY full_name ASC').all();
    
    const mappedDelegates = delegates.map((d: any) => mapToFrontend(d, DELEGATE_MAPPING));
    
    db.close();
    return NextResponse.json(mappedDelegates);
  } catch (error: any) {
    console.error('Delegates API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    const id = data.id || crypto.randomUUID();
    data.id = id;

    const { sql, params } = generateInsert('delegates', DELEGATE_MAPPING, data);
    db.prepare(sql).run(...params);
    
    db.close();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Delegates POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    if (!data.id) throw new Error('ID is required');
    
    const db = new Database(dbPath);
    const { sql, params } = generateUpdate('delegates', DELEGATE_MAPPING, data);
    db.prepare(sql).run(...params);
    
    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delegates PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');

    const db = new Database(dbPath);
    // Before deleting, check if any members are linked
    const linked = db.prepare('SELECT COUNT(*) as count FROM members WHERE delegate_id = ?').get(id) as any;
    if (linked.count > 0) {
      db.close();
      return NextResponse.json({ error: `No se puede eliminar: hay ${linked.count} agremiados vinculados a este delegado.` }, { status: 400 });
    }

    db.prepare('DELETE FROM delegates WHERE id = ?').run(id);
    db.close();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delegates DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

