import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isProduction, sSelect, sSelectOne, sInsert, sUpdate, sDelete } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const action = searchParams.get('action');

    if (isProduction) {
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
      const member = await sSelectOne('members', `employee_id=eq.${encodeURIComponent(employeeId)}`);
      const attendance = await sSelect('member_attendance', `select=*,events(id,name,date)&employee_id=eq.${encodeURIComponent(employeeId)}&order=created_at.desc`);
      const totalEventsArr = await sSelect('events', 'select=id');
      return NextResponse.json({
        success: true,
        member: member ? { id: member.id, fullName: member.full_name, employeeId: member.employee_id, memberType: member.member_type, status: member.status, position: member.position, department: member.department, photoUrl: member.photo_url } : null,
        attendance: attendance.map((a: any) => ({ id: a.events?.id, name: a.events?.name, date: a.events?.date, created_at: a.created_at })),
        totalEvents: totalEventsArr.length,
        attendedEventsCount: attendance.length,
      });
    }

    // SQLite fallback
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));

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
    const member = db.prepare('SELECT * FROM members WHERE employee_id = ?').get(employeeId) as any;
    const attendance = db.prepare(`SELECT e.id, e.name, e.date, ma.created_at FROM member_attendance ma JOIN events e ON ma.event_id = e.id WHERE ma.employee_id = ? ORDER BY e.date DESC, ma.created_at DESC`).all(employeeId);
    const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;
    db.close();
    return NextResponse.json({
      success: true,
      member: member ? { id: member.id, fullName: member.full_name, employeeId: member.employee_id, memberType: member.member_type, status: member.status, position: member.position, department: member.department, photoUrl: member.photo_url } : null,
      attendance, totalEvents, attendedEventsCount: attendance.length,
    });
  } catch (error: any) {
    console.error('Attendance API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    db.close();
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Attendance POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
