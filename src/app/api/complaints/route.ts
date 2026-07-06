import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isProduction, sSelect, sSelectOne, sInsert, sUpdate, sDelete } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth-utils';

// Helper to initialize table in local SQLite
async function initSQLiteTable() {
  const Database = (await import('better-sqlite3')).default;
  const path = await import('path');
  const db = new Database(path.join(process.cwd(), 'database.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_complaints (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      description TEXT NOT NULL,
      follow_up TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES members(employee_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_employee ON member_complaints(employee_id);
  `);
  return db;
}

export async function GET(request: Request) {
  if (
    !await hasPermission('canSearchMember') && 
    !await hasPermission('canViewReports') &&
    !await hasPermission('canViewMemberReports') &&
    !await hasPermission('canViewComplaints')
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (isProduction) {
      if (employeeId) {
        // Fetch complaints of a specific member
        const complaints = await sSelect('member_complaints', `employee_id=eq.${encodeURIComponent(employeeId)}&order=report_date.desc,created_at.desc`);
        return NextResponse.json({ success: true, complaints });
      } else {
        // Fetch all complaints
        const complaints = await sSelect('member_complaints', 'order=report_date.desc,created_at.desc');
        const empIds = complaints.map((c: any) => c.employee_id);
        let membersMap: Record<string, any> = {};
        if (empIds.length > 0) {
          // Get member details for each complaint
          const uniqueEmpIds = Array.from(new Set(empIds));
          const members = await sSelect('members', `select=employee_id,full_name,department,status&employee_id=in.(${uniqueEmpIds.join(',')})`);
          for (const m of members) {
            membersMap[m.employee_id] = m;
          }
        }
        const mapped = complaints.map((c: any) => {
          const m = membersMap[c.employee_id] || {};
          return {
            id: c.id,
            employee_id: c.employee_id,
            report_date: c.report_date,
            description: c.description,
            follow_up: c.follow_up,
            created_at: c.created_at,
            member_name: m.full_name || 'N/A',
            member_department: m.department || 'N/A',
            member_status: m.status || 'ACTIVO'
          };
        });
        return NextResponse.json({ success: true, complaints: mapped });
      }
    }

    // Local SQLite fallback
    const db = await initSQLiteTable();

    if (employeeId) {
      const complaints = db.prepare(`
        SELECT * FROM member_complaints 
        WHERE employee_id = ? 
        ORDER BY report_date DESC, created_at DESC
      `).all(employeeId);
      db.close();
      return NextResponse.json({ success: true, complaints });
    } else {
      const complaints = db.prepare(`
        SELECT c.*, m.full_name as member_name, m.department as member_department, m.status as member_status 
        FROM member_complaints c 
        LEFT JOIN members m ON c.employee_id = m.employee_id 
        ORDER BY c.report_date DESC, c.created_at DESC
      `).all();
      db.close();
      return NextResponse.json({ success: true, complaints });
    }
  } catch (error: any) {
    console.error('Complaints GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (
    !await hasPermission('canViewReports') && 
    !await hasPermission('canCreateMember') &&
    !await hasPermission('canViewComplaints')
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const data = await request.json();
    const { id, employeeId, reportDate, description, followUp } = data;

    if (!employeeId || !reportDate || !description) {
      return NextResponse.json({ error: 'Nómina, fecha de levantamiento y descripción son requeridos.' }, { status: 400 });
    }

    const complaintId = id || crypto.randomUUID();

    if (isProduction) {
      if (id) {
        // Update
        await sUpdate('member_complaints', `id=eq.${id}`, {
          report_date: reportDate,
          description,
          follow_up: followUp
        });
      } else {
        // Insert
        await sInsert('member_complaints', {
          id: complaintId,
          employee_id: employeeId,
          report_date: reportDate,
          description,
          follow_up: followUp
        });
      }
      return NextResponse.json({ success: true, id: complaintId });
    }

    // Local SQLite fallback
    const db = await initSQLiteTable();

    if (id) {
      // Update
      db.prepare(`
        UPDATE member_complaints 
        SET report_date = ?, description = ?, follow_up = ? 
        WHERE id = ?
      `).run(reportDate, description, followUp, id);
    } else {
      // Insert
      db.prepare(`
        INSERT INTO member_complaints (id, employee_id, report_date, description, follow_up) 
        VALUES (?, ?, ?, ?, ?)
      `).run(complaintId, employeeId, reportDate, description, followUp);
    }

    db.close();
    return NextResponse.json({ success: true, id: complaintId });
  } catch (error: any) {
    console.error('Complaints POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (
    !await hasPermission('canViewReports') && 
    !await hasPermission('canCreateMember') &&
    !await hasPermission('canViewComplaints')
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');

    if (isProduction) {
      await sDelete('member_complaints', `id=eq.${id}`);
    } else {
      const db = await initSQLiteTable();
      db.prepare('DELETE FROM member_complaints WHERE id = ?').run(id);
      db.close();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Complaints DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
