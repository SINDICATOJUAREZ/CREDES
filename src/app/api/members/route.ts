import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { MEMBER_MAPPING, mapToFrontend, generateInsert, generateUpdate } from '@/lib/db-utils';
import { isProduction, sSelect, sSelectCount, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { hasPermission, getSessionUser } from '@/lib/auth-utils';

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

function sanitizeNumber(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

function sanitizeIntOrNull(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

async function resolveDelegateSupabase(delegateVal: any): Promise<{ delegateId: string | null; delegateLegacy: string | null }> {
  if (delegateVal === undefined) return { delegateId: null, delegateLegacy: null };
  const clean = typeof delegateVal === 'string' ? delegateVal.trim() : '';
  if (!clean) return { delegateId: null, delegateLegacy: null };
  try {
    const matched = await sSelect('delegates', `or=(full_name.eq.${encodeURIComponent(clean)},id.eq.${encodeURIComponent(clean)})&limit=1`);
    if (matched && matched.length > 0) {
      return { delegateId: matched[0].id, delegateLegacy: matched[0].full_name };
    }
  } catch (e) {
    console.error('Error resolving delegate in Supabase:', e);
  }
  return { delegateId: null, delegateLegacy: clean };
}

function resolveDelegateSQLite(db: any, delegateVal: any): { delegateId: string | null; delegateLegacy: string | null } {
  if (delegateVal === undefined) return { delegateId: null, delegateLegacy: null };
  const clean = typeof delegateVal === 'string' ? delegateVal.trim() : '';
  if (!clean) return { delegateId: null, delegateLegacy: null };
  try {
    const matched = db.prepare('SELECT id, full_name FROM delegates WHERE full_name = ? OR id = ? LIMIT 1').get(clean, clean) as any;
    if (matched) {
      return { delegateId: matched.id, delegateLegacy: matched.full_name };
    }
  } catch (e) {
    console.error('Error resolving delegate in SQLite:', e);
  }
  return { delegateId: null, delegateLegacy: clean };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const hasAccess = 
    user.role === 'MASTER' ||
    user.permissions?.canSearchMember ||
    user.permissions?.canPrintCredentials ||
    user.permissions?.canViewPensioners ||
    user.permissions?.canViewMemberReports ||
    user.permissions?.canViewReports ||
    user.permissions?.canViewBirthdays ||
    user.permissions?.canViewComplaints ||
    user.permissions?.canCreateMember;

  if (!hasAccess) {
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
        query += `&member_type=eq.${encodeURIComponent(memberType)}`;
      }
      if (status) {
        if (status === 'PENSIONADO') {
          query += `&status=in.(BAJA,INCAPACITADO)`;
        } else {
          query += `&status=eq.${encodeURIComponent(status)}`;
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
        const safeIds = ids.map(encodeURIComponent).join(',');
        const family = await sSelect('family_members', `member_id=in.(${safeIds})`);
        for (const f of family) {
          if (!familyMap[f.member_id]) familyMap[f.member_id] = [];
          familyMap[f.member_id].push({ id: f.id, fullName: f.full_name, relationship: f.relationship, age: f.age });
        }
      }

      // Get delegates map for resolving assigned delegate name
      let delegateMap: Record<string, string> = {};
      try {
        const delegatesList = await sSelect('delegates', 'select=id,full_name');
        for (const d of delegatesList) {
          delegateMap[d.id] = d.full_name;
        }
      } catch (e) {
        console.error('Error fetching delegates for map:', e);
      }

      let membersWithFamily = members.map((m: any) => {
        const member = mapToFrontend(m, MEMBER_MAPPING);
        const delegateName = (m.delegate_id && delegateMap[m.delegate_id]) || m.delegate_name_legacy || '';
        return {
          ...member,
          delegate: delegateName,
          delegateId: m.delegate_id || undefined,
          family: familyMap[m.id] || [],
        };
      });

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
    const delegatesList = db.prepare('SELECT id, full_name FROM delegates').all() as any[];
    const delegateMap: Record<string, string> = {};
    for (const d of delegatesList) {
      delegateMap[d.id] = d.full_name;
    }
    const familyStmt = db.prepare('SELECT * FROM family_members WHERE member_id = ?');

    const membersWithFamily = members.map((m: any) => {
      const member = mapToFrontend(m, MEMBER_MAPPING);
      const delegateName = (m.delegate_id && delegateMap[m.delegate_id]) || m.delegate_name_legacy || '';
      return {
        ...member,
        delegate: delegateName,
        delegateId: m.delegate_id || undefined,
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
      if (data.delegate !== undefined) {
        const { delegateId, delegateLegacy } = await resolveDelegateSupabase(data.delegate);
        dbData.delegate_id = delegateId;
        dbData.delegate_name_legacy = delegateLegacy;
      }
      if (data.salary !== undefined) dbData.salary = sanitizeNumber(data.salary, 0);
      if (data.bonos !== undefined) dbData.bonos = sanitizeNumber(data.bonos, 0);
      if (data.bonoAsistencia !== undefined) dbData.bono_asistencia = sanitizeNumber(data.bonoAsistencia, 0);
      dbData.last_updated = new Date().toISOString();

      await sInsert('members', dbData);
      if (family && Array.isArray(family)) {
        const familyRows = family.map((f: any) => ({
          id: f.id || crypto.randomUUID(), member_id: id,
          full_name: f.fullName, relationship: f.relationship, age: sanitizeIntOrNull(f.age),
        }));
        if (familyRows.length) await sInsert('family_members', familyRows);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));

      const insertData = { ...data };
      if (data.delegate !== undefined) {
        const { delegateId, delegateLegacy } = resolveDelegateSQLite(db, data.delegate);
        insertData.delegateId = delegateId;
        insertData.delegateNameLegacy = delegateLegacy;
      }
      if (data.salary !== undefined) insertData.salary = sanitizeNumber(data.salary, 0);
      if (data.bonos !== undefined) insertData.bonos = sanitizeNumber(data.bonos, 0);
      if (data.bonoAsistencia !== undefined) insertData.bonoAsistencia = sanitizeNumber(data.bonoAsistencia, 0);
      insertData.lastUpdated = new Date().toISOString();

      const { sql, params } = generateInsert('members', MEMBER_MAPPING, insertData);
      db.transaction(() => {
        db.prepare(sql).run(...params);
        if (data.family && Array.isArray(data.family)) {
          const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
          data.family.forEach((f: any) => {
            insertFamily.run(f.id || crypto.randomUUID(), id, f.fullName, f.relationship, sanitizeIntOrNull(f.age));
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
    if (!data.id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(data.id);

    if (isProduction) {
      const { id, family, ...rest } = data;
      const dbData: any = {};
      for (const [dbKey, fsKey] of Object.entries(MEMBER_MAPPING)) {
        if (rest[fsKey as string] !== undefined) dbData[dbKey] = rest[fsKey as string];
      }
      if (data.delegate !== undefined) {
        const { delegateId, delegateLegacy } = await resolveDelegateSupabase(data.delegate);
        dbData.delegate_id = delegateId;
        dbData.delegate_name_legacy = delegateLegacy;
      }
      if (data.salary !== undefined) dbData.salary = sanitizeNumber(data.salary, 0);
      if (data.bonos !== undefined) dbData.bonos = sanitizeNumber(data.bonos, 0);
      if (data.bonoAsistencia !== undefined) dbData.bono_asistencia = sanitizeNumber(data.bonoAsistencia, 0);
      dbData.last_updated = new Date().toISOString();

      await sUpdate('members', `id=eq.${safeId}`, dbData);
      await sDelete('family_members', `member_id=eq.${safeId}`);
      if (family && Array.isArray(family)) {
        const familyRows = family.map((f: any) => ({
          id: f.id || crypto.randomUUID(), member_id: data.id,
          full_name: f.fullName, relationship: f.relationship, age: sanitizeIntOrNull(f.age),
        }));
        if (familyRows.length) await sInsert('family_members', familyRows);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));

      const updateData = { ...data };
      if (data.delegate !== undefined) {
        const { delegateId, delegateLegacy } = resolveDelegateSQLite(db, data.delegate);
        updateData.delegateId = delegateId;
        updateData.delegateNameLegacy = delegateLegacy;
      }
      if (data.salary !== undefined) updateData.salary = sanitizeNumber(data.salary, 0);
      if (data.bonos !== undefined) updateData.bonos = sanitizeNumber(data.bonos, 0);
      if (data.bonoAsistencia !== undefined) updateData.bonoAsistencia = sanitizeNumber(data.bonoAsistencia, 0);
      updateData.lastUpdated = new Date().toISOString();

      const { sql, params } = generateUpdate('members', MEMBER_MAPPING, updateData);
      db.transaction(() => {
        db.prepare(sql).run(...params);
        db.prepare('DELETE FROM family_members WHERE member_id = ?').run(data.id);
        if (data.family && Array.isArray(data.family)) {
          const insertFamily = db.prepare('INSERT INTO family_members (id, member_id, full_name, relationship, age) VALUES (?, ?, ?, ?, ?)');
          data.family.forEach((f: any) => {
            insertFamily.run(f.id || crypto.randomUUID(), data.id, f.fullName, f.relationship, sanitizeIntOrNull(f.age));
          });
        }
      })();
      db.close();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar agremiado' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    const safeId = encodeURIComponent(id);

    if (isProduction) {
      await sDelete('members', `id=eq.${safeId}`);
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
    return NextResponse.json({ error: 'Error al eliminar agremiado' }, { status: 500 });
  }
}
