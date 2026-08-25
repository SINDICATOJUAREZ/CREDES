import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { MEMBER_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';
import { isProduction, sSelect, sSelectCount, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth-utils';

const getIsPensioner = (m: any) => {
  const joinDate = m.joinDate || m.join_date;
  const birthDate = m.birthDate || m.birth_date;
  const status = m.status;
  if (!joinDate) return false;
  const today = new Date();
  const parseDateStr = (dateStr: any) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };
  const jDate = parseDateStr(joinDate);
  const bDate = parseDateStr(birthDate);
  if (!jDate) return false;
  
  let years = today.getFullYear() - jDate.getFullYear();
  if (today < new Date(today.getFullYear(), jDate.getMonth(), jDate.getDate())) years--;
  
  if (status === 'INCAPACITADO') {
    return years >= 10;
  }
  
  if (!bDate) return false;
  let age = today.getFullYear() - bDate.getFullYear();
  if (today < new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
  
  return age >= 50 && years >= 10;
};

export async function GET(request: Request) {
  if (
    !await hasPermission('canSearchMember') && 
    !await hasPermission('canViewPensioners') && 
    !await hasPermission('canViewMemberReports') &&
    !await hasPermission('canViewReports')
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const memberType = searchParams.get('memberType') || '';
    const status = searchParams.get('status') || '';
    const employeeId = searchParams.get('employeeId') || '';
    const fullName = searchParams.get('fullName') || '';
    const position = searchParams.get('position') || '';
    const department = searchParams.get('department') || '';
    const offset = (page - 1) * limit;

    if (isProduction) {
      let query = `order=full_name.asc`;
      if (status !== 'PENSIONADO') {
        query += `&limit=${limit}&offset=${offset}`;
      }
      if (search) {
        const s = encodeURIComponent(`*${search}*`);
        query += `&or=(full_name.ilike.${s},employee_id.ilike.${s},department.ilike.${s})`;
      } else if (!status) {
        query += `&status=neq.BAJA`;
      }
      if (memberType) {
        query += `&member_type=eq.${memberType}`;
      }
      if (status) {
        if (status === 'PENSIONADO') {
          query += `&status=in.(BAJA,INCAPACITADO)`;
        } else {
          query += `&status=eq.${status}`;
        }
      }
      if (employeeId) {
        query += `&employee_id=ilike.*${encodeURIComponent(employeeId)}*`;
      }
      if (fullName) {
        query += `&full_name=ilike.*${encodeURIComponent(fullName)}*`;
      }
      if (position) {
        query += `&position=ilike.*${encodeURIComponent(position)}*`;
      }
      if (department) {
        query += `&department=ilike.*${encodeURIComponent(department)}*`;
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

      let membersWithFamily = members.map((m: any) => ({
        ...mapToFrontend(m, MEMBER_MAPPING),
        family: familyMap[m.id] || [],
      }));

      let finalTotal = total;
      if (status === 'PENSIONADO') {
        membersWithFamily = membersWithFamily.filter(getIsPensioner);
        finalTotal = membersWithFamily.length;
        membersWithFamily = membersWithFamily.slice(offset, offset + limit);
      }

      const calculatedTotalPages = Math.max(1, Math.ceil(finalTotal / limit));
      return NextResponse.json({
        data: membersWithFamily,
        total: finalTotal,
        page,
        limit,
        totalPages: calculatedTotalPages,
        meta: { total: finalTotal, page, limit, totalPages: calculatedTotalPages },
      });
    }

    // SQLite fallback
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));

    let baseQuery = 'FROM members WHERE 1=1';
    const params: any[] = [];
    if (search) {
      baseQuery += ' AND (full_name LIKE ? OR employee_id LIKE ? OR department LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    } else if (!status) {
      baseQuery += " AND status != 'BAJA'";
    }
    if (memberType) {
      baseQuery += ' AND member_type = ?';
      params.push(memberType);
    }
    if (status) {
      if (status === 'PENSIONADO') {
        baseQuery += " AND status IN ('BAJA', 'INCAPACITADO')";
      } else {
        baseQuery += ' AND status = ?';
        params.push(status);
      }
    }
    if (employeeId) {
      baseQuery += ' AND employee_id LIKE ?';
      params.push(`%${employeeId}%`);
    }
    if (fullName) {
      baseQuery += ' AND full_name LIKE ?';
      params.push(`%${fullName}%`);
    }
    if (position) {
      baseQuery += ' AND position LIKE ?';
      params.push(`%${position}%`);
    }
    if (department) {
      baseQuery += ' AND department LIKE ?';
      params.push(`%${department}%`);
    }

    // If filtering by PENSIONADO, we fetch all BAJA/INCAPACITADO records, then filter and slice in JS
    let limitOffsetClause = 'LIMIT ? OFFSET ?';
    let sqlParams = [...params, limit, offset];
    if (status === 'PENSIONADO') {
      limitOffsetClause = '';
      sqlParams = params;
    }

    const totalResult = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params) as { total: number };
    const members = db.prepare(`SELECT * ${baseQuery} ORDER BY full_name ASC ${limitOffsetClause}`).all(...sqlParams);
    const familyStmt = db.prepare('SELECT * FROM family_members WHERE member_id = ?');

    const membersWithFamily = members.map((m: any) => {
      const member = mapToFrontend(m, MEMBER_MAPPING);
      return {
        ...member,
        family: familyStmt.all(m.id).map((f: any) => ({ id: f.id, fullName: f.full_name, relationship: f.relationship, age: f.age })),
      };
    });

    db.close();

    let finalMembers = membersWithFamily;
    let finalTotal = totalResult.total;

    if (status === 'PENSIONADO') {
      const allPensioners = membersWithFamily.filter(getIsPensioner);
      finalTotal = allPensioners.length;
      finalMembers = allPensioners.slice(offset, offset + limit);
    }

    const calculatedTotalPages = Math.max(1, Math.ceil(finalTotal / limit));
    return NextResponse.json({
      data: finalMembers,
      total: finalTotal,
      page,
      limit,
      totalPages: calculatedTotalPages,
      meta: { total: finalTotal, page, limit, totalPages: calculatedTotalPages },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
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
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
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
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
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
