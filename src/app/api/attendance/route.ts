import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isProduction, sSelect, sSelectOne, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { MEMBER_MAPPING, mapToFrontend } from '@/lib/db-utils';
import { hasPermission } from '@/lib/auth-utils';

function extractEmployeeId(text: string): string | null {
  if (!text) return null;
  // Try spelling variants of NOMINA
  const match = text.match(/(?:NOMINA|NÓMINA|NOMIONA|NIMINA|NOMONA|NOMIN|NOMIONA)[^\d]*(\d+)/i);
  if (match) {
    return match[1];
  }
  // Try a 3-6 digit number anywhere in the string
  const numMatch = text.match(/\b(\d{3,6})\b/);
  if (numMatch) {
    return numMatch[1];
  }
  return null;
}

const MONTHS: Record<string, string> = {
  ENE: '01', ENERO: '01',
  FEB: '02', FEBRERO: '02',
  MAR: '03', MARZO: '03',
  ABR: '04', ABRIL: '04',
  MAY: '05', MAYO: '05',
  JUN: '06', JUNIO: '06',
  JUL: '07', JULIO: '07',
  AGO: '08', AGOSTO: '08',
  SEP: '09', SEPTIEMBRE: '09',
  OCT: '10', OCTUBRE: '10',
  NOV: '11', NOVIEMBRE: '11',
  DIC: '12', DICIEMBRE: '12'
};

function extractDateFromEventName(name: string): string {
  if (!name) return '1970-01-01';
  const upper = name.toUpperCase().trim();
  
  // 1. Check YYYY-MM-DD
  const ymdMatch = upper.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (ymdMatch) {
    return ymdMatch[0];
  }
  
  // 2. Check DD/MM/YYYY or DD/MM/YY
  const dmyMatch = upper.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  
  // 3. Check Month-DD-YY or Month-DD-YYYY (e.g. AGO-28-25, ABRIL-10-2025, DIC/11/25)
  const monthNames = Object.keys(MONTHS).join('|');
  const monthDayYearRegex = new RegExp(`\\b(${monthNames})[-/\\s](\\d{1,2})[-/\\s](\\d{2,4})\\b`, 'i');
  const mdyMatch = upper.match(monthDayYearRegex);
  if (mdyMatch) {
    const month = MONTHS[mdyMatch[1]];
    const day = mdyMatch[2].padStart(2, '0');
    let year = mdyMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  // 4. Check DD-Month-YY or DD-Month-YYYY (e.g. 18 FEB 2026)
  const dayMonthYearRegex = new RegExp(`\\b(\\d{1,2})[-/\\s](${monthNames})[-/\\s](\\d{2,4})\\b`, 'i');
  const dmyWordMatch = upper.match(dayMonthYearRegex);
  if (dmyWordMatch) {
    const day = dmyWordMatch[1].padStart(2, '0');
    const month = MONTHS[dmyWordMatch[2]];
    let year = dmyWordMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  // 5. Just a 4-digit year (e.g. SAMS 2025)
  const yearMatch = upper.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }
  
  return '1970-01-01';
}


export async function GET(request: Request) {
  if (!await hasPermission('canViewReports')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const action = searchParams.get('action');

    if (isProduction) {
      if (action === 'top20') {
        const attendance = await sSelect('member_attendance', 'select=employee_id');
        const members = await sSelect('members', 'select=employee_id,full_name,member_type,status,department,photo_url,birth_date,join_date');
        
        const counts: Record<string, number> = {};
        for (const a of attendance) {
          if (a.employee_id) {
            counts[a.employee_id] = (counts[a.employee_id] || 0) + 1;
          }
        }
        
        const membersMap: Record<string, any> = {};
        for (const m of members) {
          membersMap[m.employee_id] = m;
        }
        
        const result = Object.entries(counts).map(([empId, count]) => {
          const m = membersMap[empId] || {};
          return {
            employeeId: empId,
            fullName: m.full_name || `Nómina ${empId}`,
            memberType: m.member_type || 'UNKNOWN',
            status: m.status || 'UNKNOWN',
            department: m.department || 'N/A',
            photoUrl: m.photo_url || null,
            birthDate: m.birth_date || null,
            joinDate: m.join_date || null,
            count
          };
        });
        
        result.sort((a, b) => b.count - a.count);
        return NextResponse.json({ success: true, data: result });
      }

      if (action === 'listEvents') {
        const events = await sSelect('events', 'select=*,member_attendance(count)&order=date.desc,name.desc,created_at.desc');
        const mapped = events.map((e: any) => ({
          ...e,
          attendee_count: e.member_attendance?.[0]?.count || 0,
          member_attendance: undefined,
        }));
        return NextResponse.json({ success: true, events: mapped });
      }

      if (action === 'eventAttendees') {
        const eventId = searchParams.get('eventId');
        if (!eventId) return NextResponse.json({ error: 'Se requiere eventId' }, { status: 400 });
        const event = await sSelectOne('events', `id=eq.${eventId}`);
        const attendance = await sSelect('member_attendance', `event_id=eq.${eventId}&order=created_at.desc`);
        // Get member info for attendees
        const empIds = attendance.map((a: any) => a.employee_id);
        let membersMap: Record<string, any> = {};
        if (empIds.length > 0) {
          const members = await sSelect('members', `select=employee_id,full_name,member_type,status,department,photo_url&employee_id=in.(${empIds.join(',')})`);
          for (const m of members) membersMap[m.employee_id] = m;
        }
        const attendees = attendance.map((a: any) => {
          const m = membersMap[a.employee_id] || {};
          return { employee_id: a.employee_id, created_at: a.created_at, full_name: m.full_name, member_type: m.member_type, status: m.status, department: m.department, photo_url: m.photo_url };
        });
        return NextResponse.json({ success: true, event, attendees });
      }

      if (!employeeId) return NextResponse.json({ error: 'Se requiere employeeId' }, { status: 400 });
      const cleanId = employeeId.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let member = await sSelectOne('members', `or=(employee_id.eq.${encodeURIComponent(cleanId)},legacy_qr_data.eq.${encodeURIComponent(cleanId)})`);
      
      if (!member) {
        const extracted = extractEmployeeId(cleanId);
        if (extracted) {
          member = await sSelectOne('members', `employee_id=eq.${encodeURIComponent(extracted)}`);
        }
      }

      const actualEmployeeId = member ? member.employee_id : cleanId;
      const attendance = await sSelect('member_attendance', `select=*,events(id,name,date)&employee_id=eq.${encodeURIComponent(actualEmployeeId)}&order=created_at.desc`);
      const totalEventsArr = await sSelect('events', 'select=id');
      const mappedAttendance = attendance.map((a: any) => ({ id: a.events?.id, name: a.events?.name, date: a.events?.date, created_at: a.created_at }));
      // Sort in JS ascending by extracted date from event name
      mappedAttendance.sort((a: any, b: any) => {
        const dateA = extractDateFromEventName(a.name);
        const dateB = extractDateFromEventName(b.name);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
      return NextResponse.json({
        success: true,
        member: member ? mapToFrontend(member, MEMBER_MAPPING) : null,
        attendance: mappedAttendance,
        totalEvents: totalEventsArr.length,
        attendedEventsCount: attendance.length,
      });
    }

    // SQLite fallback
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));

    if (action === 'top20') {
      const rows = db.prepare(`
        SELECT ma.employee_id as employeeId, COUNT(*) as count, m.full_name as fullName, 
               m.member_type as memberType, m.status, m.department, m.photo_url as photoUrl,
               m.birth_date as birthDate, m.join_date as joinDate
        FROM member_attendance ma
        LEFT JOIN members m ON m.employee_id = ma.employee_id
        GROUP BY ma.employee_id
        ORDER BY count DESC
      `).all() as any[];
      db.close();
      
      const result = rows.map(r => ({
        ...r,
        fullName: r.fullName || `Nómina ${r.employeeId}`,
        memberType: r.memberType || 'UNKNOWN',
        status: r.status || 'UNKNOWN',
        department: r.department || 'N/A',
        birthDate: r.birthDate || null,
        joinDate: r.joinDate || null
      }));
      
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'listEvents') {
      const events = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM member_attendance ma WHERE ma.event_id = e.id) as attendee_count FROM events e ORDER BY e.date DESC, e.name DESC, e.created_at DESC`).all();
      db.close();
      return NextResponse.json({ success: true, events });
    }

    if (action === 'eventAttendees') {
      const eventId = searchParams.get('eventId');
      if (!eventId) { db.close(); return NextResponse.json({ error: 'Se requiere eventId' }, { status: 400 }); }
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      const attendees = db.prepare(`SELECT ma.employee_id, ma.created_at, m.full_name, m.member_type, m.status, m.department, m.photo_url FROM member_attendance ma LEFT JOIN members m ON m.employee_id = ma.employee_id WHERE ma.event_id = ? ORDER BY ma.created_at DESC`).all(eventId);
      db.close();
      return NextResponse.json({ success: true, event, attendees });
    }

    if (!employeeId) { db.close(); return NextResponse.json({ error: 'Se requiere employeeId' }, { status: 400 }); }
    const cleanId = employeeId.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let member = db.prepare('SELECT * FROM members WHERE employee_id = ? OR legacy_qr_data = ?').get(cleanId, cleanId) as any;
    
    if (!member) {
      const extracted = extractEmployeeId(cleanId);
      if (extracted) {
        member = db.prepare('SELECT * FROM members WHERE employee_id = ?').get(extracted) as any;
      }
    }

    const actualEmployeeId = member ? member.employee_id : cleanId;
    const attendance = db.prepare(`SELECT e.id, e.name, e.date, ma.created_at FROM member_attendance ma JOIN events e ON ma.event_id = e.id WHERE ma.employee_id = ?`).all(actualEmployeeId) as any[];
    // Sort in JS ascending by extracted date from event name
    attendance.sort((a: any, b: any) => {
      const dateA = extractDateFromEventName(a.name);
      const dateB = extractDateFromEventName(b.name);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
    const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;
    db.close();
    return NextResponse.json({
      success: true,
      member: member ? mapToFrontend(member, MEMBER_MAPPING) : null,
      attendance, totalEvents, attendedEventsCount: attendance.length,
    });
  } catch (error: any) {
    console.error('Attendance API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await hasPermission('canViewReports')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const data = await request.json();

    if (isProduction) {
      if (data.action === 'createEvent') {
        const id = crypto.randomUUID();
        await sInsert('events', { id, name: data.name, date: data.date });
        return NextResponse.json({ success: true, id, name: data.name, date: data.date });
      }
      if (data.action === 'addAttendance') {
        const existing = await sSelectOne('member_attendance', `event_id=eq.${data.eventId}&employee_id=eq.${encodeURIComponent(data.employeeId)}`);
        if (existing) {
          const member = await sSelectOne('members', `employee_id=eq.${encodeURIComponent(data.employeeId)}`);
          return NextResponse.json({ success: false, duplicate: true, member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url } : null });
        }
        await sInsert('member_attendance', { id: crypto.randomUUID(), employee_id: data.employeeId, event_id: data.eventId });
        const member = await sSelectOne('members', `employee_id=eq.${encodeURIComponent(data.employeeId)}`);
        const countArr = await sSelect('member_attendance', `select=id&event_id=eq.${data.eventId}`);
        return NextResponse.json({ success: true, member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url, department: member.department } : null, totalAttendees: countArr.length });
      }
      if (data.action === 'deleteEvent') {
        await sDelete('member_attendance', `event_id=eq.${data.eventId}`);
        await sDelete('events', `id=eq.${data.eventId}`);
        return NextResponse.json({ success: true });
      }
      if (data.action === 'renameEvent') {
        await sUpdate('events', `id=eq.${data.eventId}`, { name: data.name });
        return NextResponse.json({ success: true, name: data.name });
      }
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // SQLite fallback
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));

    if (data.action === 'createEvent') {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO events (id, name, date) VALUES (?, ?, ?)').run(id, data.name, data.date);
      db.close();
      return NextResponse.json({ success: true, id, name: data.name, date: data.date });
    }
    if (data.action === 'addAttendance') {
      const existing = db.prepare('SELECT id FROM member_attendance WHERE event_id = ? AND employee_id = ?').get(data.eventId, data.employeeId);
      if (existing) {
        const member = db.prepare('SELECT full_name, member_type, status, photo_url FROM members WHERE employee_id = ?').get(data.employeeId) as any;
        db.close();
        return NextResponse.json({ success: false, duplicate: true, member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url } : null });
      }
      db.prepare('INSERT INTO member_attendance (id, employee_id, event_id) VALUES (?, ?, ?)').run(crypto.randomUUID(), data.employeeId, data.eventId);
      const member = db.prepare('SELECT full_name, member_type, status, photo_url, department FROM members WHERE employee_id = ?').get(data.employeeId) as any;
      const count = (db.prepare('SELECT COUNT(*) as count FROM member_attendance WHERE event_id = ?').get(data.eventId) as any).count;
      db.close();
      return NextResponse.json({ success: true, member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url, department: member.department } : null, totalAttendees: count });
    }
    if (data.action === 'deleteEvent') {
      db.prepare('DELETE FROM member_attendance WHERE event_id = ?').run(data.eventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(data.eventId);
      db.close();
      return NextResponse.json({ success: true });
    }
    if (data.action === 'renameEvent') {
      db.prepare('UPDATE events SET name = ? WHERE id = ?').run(data.name, data.eventId);
      db.close();
      return NextResponse.json({ success: true, name: data.name });
    }
    db.close();
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Attendance POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
