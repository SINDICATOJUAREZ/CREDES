const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const crypto = require('crypto');

function run() {
    const dbPath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\database.sqlite';
    const excelPath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';
    
    console.log(`Connecting to database...`);
    const db = new Database(dbPath);

    // Drop and recreate
    db.exec(`
        DROP TABLE IF EXISTS member_attendance;
        DROP TABLE IF EXISTS events;

        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_attendance (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            attended INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_employee ON member_attendance(employee_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_event ON member_attendance(event_id);
    `);

    console.log(`Reading excel file...`);
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        console.log("No data found.");
        return;
    }

    // Get all unique column names from ALL rows, not just the first
    const allColNames = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(k => allColNames.add(k));
    });

    const nonEventCols = new Set(['Nomina', 'NOMINA', 'Nombre', 'NOMBRE', 'Estatus', 'ESTATUS', 'STATUS']);
    const eventNames = [...allColNames].filter(col => col && !nonEventCols.has(col.toString().trim()));

    console.log(`Found ${eventNames.length} unique events across all rows.`);

    // Insert events with proper UUIDs
    const insertEvent = db.prepare('INSERT OR IGNORE INTO events (id, name) VALUES (?, ?)');
    const eventsMap = new Map();

    db.transaction(() => {
        for (const eventName of eventNames) {
            const eventId = crypto.randomUUID();
            insertEvent.run(eventId, eventName);
            eventsMap.set(eventName, eventId);
        }
    })();

    // Re-read from DB to get actual IDs (in case of OR IGNORE)
    const dbEvents = db.prepare('SELECT id, name FROM events').all();
    eventsMap.clear();
    for (const row of dbEvents) {
        eventsMap.set(row.name, row.id);
    }

    console.log(`Events in DB: ${eventsMap.size}`);

    // Insert attendance
    const insertAttendance = db.prepare(`
        INSERT OR REPLACE INTO member_attendance (id, employee_id, event_id, attended)
        VALUES (?, ?, ?, 1)
    `);

    let attendanceCount = 0;
    let skippedNoEvent = 0;

    db.transaction(() => {
        for (const row of data) {
            const nomina = (row['Nomina'] || row['NOMINA'] || "").toString().trim();
            if (!nomina) continue;

            for (const eventName of eventNames) {
                const attendedValue = row[eventName];
                if (attendedValue && attendedValue.toString().trim() !== '') {
                    const eventId = eventsMap.get(eventName);
                    if (eventId) {
                        const attendanceId = crypto.randomUUID();
                        insertAttendance.run(attendanceId, nomina, eventId);
                        attendanceCount++;
                    } else {
                        skippedNoEvent++;
                    }
                }
            }
        }
    })();

    console.log(`\nImport complete!`);
    console.log(`  Events: ${eventsMap.size}`);
    console.log(`  Attendance records: ${attendanceCount}`);
    if (skippedNoEvent > 0) console.log(`  Skipped (no event match): ${skippedNoEvent}`);
    
    // Verify nomina 8611
    const check = db.prepare(`
        SELECT e.name FROM member_attendance ma
        JOIN events e ON ma.event_id = e.id
        WHERE ma.employee_id = '8611'
        ORDER BY e.name
    `).all();
    console.log(`\nVerification for 8611: ${check.length} events`);
    check.forEach(r => console.log(`  - ${r.name}`));

    db.close();
}

try { run(); } catch (e) { console.error("Error:", e); }
