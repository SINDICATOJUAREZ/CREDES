import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { MEMBER_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    
    const offset = (page - 1) * limit;

    const db = new Database(dbPath);
    
    let baseQuery = 'FROM members';
    const params: any[] = [];

    if (search) {
      baseQuery += ' WHERE full_name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR socio_id LIKE ?';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const totalResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalResult.total;

    // Get paginated data
    const dataQuery = `SELECT * ${baseQuery} ORDER BY full_name ASC LIMIT ? OFFSET ?`;
    const members = db.prepare(dataQuery).all(...params, limit, offset);
    
    const familyStmt = db.prepare('SELECT * FROM family_members WHERE member_id = ?');
    
    const membersWithFamily = members.map((m: any) => {
      const member = mapToFrontend(m, MEMBER_MAPPING);
      return {
        ...member,
        family: familyStmt.all(m.id).map((f: any) => ({
          id: f.id,
          fullName: f.full_name,
          relationship: f.relationship,
          age: f.age
        }))
      };
    });
    
    db.close();
    return NextResponse.json({
      data: membersWithFamily,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    const id = data.id || crypto.randomUUID();
    data.id = id;

    const { sql, params } = generateInsert('members', MEMBER_MAPPING, data);
    const insert = db.prepare(sql);

    db.transaction(() => {
      insert.run(...params);

      if (data.family && Array.isArray(data.family)) {
        const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
        data.family.forEach((f: any) => {
          insertFamily.run(f.id || crypto.randomUUID(), id, f.fullName, f.relationship, f.age);
        });
      }
    })();

    db.close();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    if (!data.id) throw new Error('ID is required');
    
    const db = new Database(dbPath);

    const { sql, params } = generateUpdate('members', MEMBER_MAPPING, data);
    const update = db.prepare(sql);

    db.transaction(() => {
      update.run(...params);

      // Refresh family members
      db.prepare('DELETE FROM family_members WHERE member_id = ?').run(data.id);
      if (data.family && Array.isArray(data.family)) {
        const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
        data.family.forEach((f: any) => {
          insertFamily.run(f.id || crypto.randomUUID(), data.id, f.fullName, f.relationship, f.age);
        });
      }
    })();

    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');

    const db = new Database(dbPath);
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    db.close();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

