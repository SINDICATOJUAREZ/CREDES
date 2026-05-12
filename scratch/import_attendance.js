const Database = require('better-sqlite3');
const XLSX = require('xlsx');

function run() {
    const dbPath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\database.sqlite';
    const excelPath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';
    
    console.log(`Connecting to database at ${dbPath}...`);
    const db = new Database(dbPath);

    // Create tables if they don't exist
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

    console.log(`Reading excel file from ${excelPath}...`);
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        console.log("No data found in excel file.");
        return;
    }

    // Read headers explicitly
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = rawData[0];
    const nonEventCols = ['Nomina', 'NOMINA', 'Nombre', 'NOMBRE', 'Estatus', 'ESTATUS', 'STATUS'];
    const eventNames = headers.filter(col => col && !nonEventCols.includes(col.toString().trim()));

    console.log(`Found ${eventNames.length} events.`);

    // Insert events
    const insertEvent = db.prepare('INSERT OR IGNORE INTO events (id, name) VALUES (?, ?)');
    
    // Create a deterministic UUID-like string for events
    const generateId = (prefix, name) => `${prefix}-${Buffer.from(name).toString('hex').substring(0, 16)}`;

    db.transaction(() => {
        for (const eventName of eventNames) {
            const eventId = generateId('evt', eventName);
            insertEvent.run(eventId, eventName);
        }
    })();

    // Fetch the inserted events to get their IDs
    const eventsMap = new Map();
    const rows = db.prepare('SELECT id, name FROM events').all();
    for (const row of rows) {
        eventsMap.set(row.name, row.id);
    }

    // Prepare attendance insertion
    // We use a composite-like ID or UUID
    const insertAttendance = db.prepare(`
        INSERT OR REPLACE INTO member_attendance (id, employee_id, event_id, attended)
        VALUES (?, ?, ?, 1)
    `);

    let attendanceCount = 0;

    console.log(`Processing ${data.length} members...`);
    db.transaction(() => {
        for (const row of data) {
            const nomina = (row['Nomina'] || row['NOMINA'] || "").toString().trim();
            if (!nomina) continue; // Skip if no nomina

            for (const eventName of eventNames) {
                const attendedValue = row[eventName];
                // If there's any value (usually '*' or 'x' or '1'), mark as attended
                if (attendedValue && attendedValue.toString().trim() !== '') {
                    const eventId = eventsMap.get(eventName);
                    if (eventId) {
                        const attendanceId = `att-${nomina}-${eventId}`;
                        insertAttendance.run(attendanceId, nomina, eventId);
                        attendanceCount++;
                    } else {
                        console.log(`Warning: Event ID not found for ${eventName}`);
                    }
                }
            }
        }
    })();

    console.log(`Successfully imported ${attendanceCount} attendance records for ${eventNames.length} events!`);
    db.close();
}

try {
    run();
} catch (error) {
    console.error("Error during import:", error);
}
