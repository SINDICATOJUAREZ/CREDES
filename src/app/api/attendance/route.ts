import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const action = searchParams.get('action');

    const db = new Database(dbPath);

    // List all events
    if (action === 'listEvents') {
      const events = db.prepare(`
        SELECT e.*, 
          (SELECT COUNT(*) FROM member_attendance ma WHERE ma.event_id = e.id) as attendee_count
        FROM events e 
        ORDER BY e.date DESC, e.name DESC, e.created_at DESC
      `).all();
      db.close();
      return NextResponse.json({ success: true, events });
    }

    // Get attendees for an event
    if (action === 'eventAttendees') {
      const eventId = searchParams.get('eventId');
      if (!eventId) {
        db.close();
        return NextResponse.json({ error: 'Se requiere eventId' }, { status: 400 });
      }
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      const attendees = db.prepare(`
        SELECT ma.employee_id, ma.created_at,
          m.full_name, m.member_type, m.status, m.department, m.photo_url
        FROM member_attendance ma
        LEFT JOIN members m ON m.employee_id = ma.employee_id
        WHERE ma.event_id = ?
        ORDER BY ma.created_at DESC
      `).all(eventId);
      db.close();
      return NextResponse.json({ success: true, event, attendees });
    }

    // Get attendance for an employee
    if (!employeeId) {
      db.close();
      return NextResponse.json({ error: 'Se requiere employeeId' }, { status: 400 });
    }

    const member = db.prepare('SELECT * FROM members WHERE employee_id = ?').get(employeeId) as any;
    
    const attendance = db.prepare(`
      SELECT e.id, e.name, e.date, ma.created_at
      FROM member_attendance ma
      JOIN events e ON ma.event_id = e.id
      WHERE ma.employee_id = ?
      ORDER BY e.date DESC, ma.created_at DESC
    `).all(employeeId);
    
    const totalEvents = (db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;

    db.close();
    
    return NextResponse.json({
      success: true,
      member: member ? {
        id: member.id,
        fullName: member.full_name,
        employeeId: member.employee_id,
        memberType: member.member_type,
        status: member.status,
        position: member.position,
        department: member.department,
        photoUrl: member.photo_url,
      } : null,
      attendance,
      totalEvents,
      attendedEventsCount: attendance.length
    });
  } catch (error: any) {
    console.error('Attendance API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);

    // Create a new event
    if (data.action === 'createEvent') {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO events (id, name, date) VALUES (?, ?, ?)').run(id, data.name, data.date);
      db.close();
      return NextResponse.json({ success: true, id, name: data.name, date: data.date });
    }

    // Add attendance to an event
    if (data.action === 'addAttendance') {
      const eventId = data.eventId;
      const employeeId = data.employeeId;
      
      // Check if already registered
      const existing = db.prepare('SELECT id FROM member_attendance WHERE event_id = ? AND employee_id = ?').get(eventId, employeeId);
      if (existing) {
        // Look up employee info
        const member = db.prepare('SELECT full_name, member_type, status, photo_url FROM members WHERE employee_id = ?').get(employeeId) as any;
        db.close();
        return NextResponse.json({ success: false, duplicate: true, member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url } : null });
      }
      
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO member_attendance (id, employee_id, event_id) VALUES (?, ?, ?)').run(id, employeeId, eventId);
      
      // Return employee info for display
      const member = db.prepare('SELECT full_name, member_type, status, photo_url, department FROM members WHERE employee_id = ?').get(employeeId) as any;
      
      const count = (db.prepare('SELECT COUNT(*) as count FROM member_attendance WHERE event_id = ?').get(eventId) as any).count;
      
      db.close();
      return NextResponse.json({ 
        success: true, 
        member: member ? { fullName: member.full_name, memberType: member.member_type, status: member.status, photoUrl: member.photo_url, department: member.department } : null,
        totalAttendees: count 
      });
    }

    // Delete an event
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
