import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { MEMBER_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';
import { isProduction, sSelect, sSelectCount, sInsert, sUpdate, sDelete } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    if (isProduction) {
      let query = `order=full_name.asc&limit=${limit}&offset=${offset}`;
      if (search) {
        const s = encodeURIComponent(`%${search}%`);
        query += `&or=(full_name.ilike.${s},employee_id.ilike.${s},department.ilike.${s},socio_id.ilike.${s})`;
      }
      const { data: members, count: total } = await sSelectCount('members', query);
      
      // Get family members for these members
      const ids = members.map((m: any) => m.id);
      let familyMap: Record<string, any[]> = {};
      if (ids.length > 0) {
        const family = await sSelect('family_members', `member_id=in.(${ids.join(',')})`);
        for (const f of family) {
          if (!familyMap[f.member_id]) familyMap[f.member_id] = [];
          familyMap[f.member_id].push({ id: f.id, fullName: f.full_name, relationship: f.relationship, age: f.age });
        }
      }

      const membersWithFamily = members.map((m: any) => ({
        ...mapToFrontend(m, MEMBER_MAPPING),
        family: familyMap[m.id] || [],
      }));

      return NextResponse.json({
        data: membersWithFamily,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    // SQLite fallback
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));

    let baseQuery = 'FROM members';
    const params: any[] = [];
    if (search) {
      baseQuery += ' WHERE full_name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR socio_id LIKE ?';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const totalResult = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params) as { total: number };
    const members = db.prepare(`SELECT * ${baseQuery} ORDER BY full_name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const familyStmt = db.prepare('SELECT * FROM family_members WHERE member_id = ?');

    const membersWithFamily = members.map((m: any) => {
      const member = mapToFrontend(m, MEMBER_MAPPING);
      return {
        ...member,
        family: familyStmt.all(m.id).map((f: any) => ({ id: f.id, fullName: f.full_name, relationship: f.relationship, age: f.age })),
      };
    });

    db.close();
    return NextResponse.json({
      data: membersWithFamily,
      meta: { total: totalResult.total, page, limit, totalPages: Math.ceil(totalResult.total / limit) },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = data.id || crypto.randomUUID();
    data.id = id;

    if (isProduction) {
      const { id: _, family, ...rest } = data;
      const dbData: any = { id };
      for (const [dbKey, fsKey] of Object.entries(MEMBER_MAPPING)) {
        if (rest[fsKey as string] !== undefined) dbData[dbKey] = rest[fsKey as string];
      }
      await sInsert('members', dbData);
      if (family && Array.isArray(family)) {
        const familyRows = family.map((f: any) => ({
          id: f.id || crypto.randomUUID(), member_id: id,
          full_name: f.fullName, relationship: f.relationship, age: f.age,
        }));
        if (familyRows.length) await sInsert('family_members', familyRows);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const { sql, params } = generateInsert('members', MEMBER_MAPPING, data);
      db.transaction(() => {
        db.prepare(sql).run(...params);
        if (data.family && Array.isArray(data.family)) {
          const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
          data.family.forEach((f: any) => {
            insertFamily.run(f.id || crypto.randomUUID(), id, f.fullName, f.relationship, f.age);
          });
        }
      })();
      db.close();
    }

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

    if (isProduction) {
      const { id, family, ...rest } = data;
      const dbData: any = {};
      for (const [dbKey, fsKey] of Object.entries(MEMBER_MAPPING)) {
        if (rest[fsKey as string] !== undefined) dbData[dbKey] = rest[fsKey as string];
      }
      await sUpdate('members', `id=eq.${id}`, dbData);
      await sDelete('family_members', `member_id=eq.${id}`);
      if (family && Array.isArray(family)) {
        const familyRows = family.map((f: any) => ({
          id: f.id || crypto.randomUUID(), member_id: id,
          full_name: f.fullName, relationship: f.relationship, age: f.age,
        }));
        if (familyRows.length) await sInsert('family_members', familyRows);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      const { sql, params } = generateUpdate('members', MEMBER_MAPPING, data);
      db.transaction(() => {
        db.prepare(sql).run(...params);
        db.prepare('DELETE FROM family_members WHERE member_id = ?').run(data.id);
        if (data.family && Array.isArray(data.family)) {
          const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
          data.family.forEach((f: any) => {
            insertFamily.run(f.id || crypto.randomUUID(), data.id, f.fullName, f.relationship, f.age);
          });
        }
      })();
      db.close();
    }

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

    if (isProduction) {
      await sDelete('members', `id=eq.${id}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
      db.close();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
