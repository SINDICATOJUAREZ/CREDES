const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Starting migration v2...');

try {
    // 1. Get all delegates to create a mapping catalog
    const delegates = db.prepare('SELECT id, full_name FROM delegates').all();
    console.log(`Found ${delegates.length} delegates.`);

    function findDelegateId(name) {
        if (!name) return null;
        const searchName = name.toString().toUpperCase().trim();
        if (!searchName) return null;

        // 1. Exact match
        let match = delegates.find(d => d.full_name.toUpperCase() === searchName);
        if (match) return match.id;

        // 2. Contains
        const searchParts = searchName.split(' ').filter(p => p.length > 2);
        if (searchParts.length > 0) {
            match = delegates.find(d => {
                const dName = d.full_name.toUpperCase();
                return searchParts.every(part => dName.includes(part));
            });
            if (match) return match.id;
        }

        return null;
    }

    db.transaction(() => {
        // 2. De-duplicate employee_id
        console.log('Resolving employee_id duplicates...');
        const dups = db.prepare('SELECT employee_id FROM members WHERE employee_id IS NOT NULL GROUP BY employee_id HAVING COUNT(*) > 1').all();
        
        for (const dup of dups) {
            const records = db.prepare('SELECT id, status FROM members WHERE employee_id = ?').all(dup.employee_id);
            // If one is BAJA and other is not, delete BAJA
            const baja = records.find(r => r.status === 'BAJA');
            const active = records.find(r => r.status !== 'BAJA');
            
            if (baja && active) {
                console.log(`Deleting duplicate BAJA record for ${dup.employee_id}`);
                db.prepare('DELETE FROM members WHERE id = ?').run(baja.id);
            } else if (records.length > 1) {
                // If both are same, just delete one
                console.log(`Deleting arbitrary duplicate for ${dup.employee_id}`);
                db.prepare('DELETE FROM members WHERE id = ?').run(records[0].id);
            }
        }

        // 3. Create new members table
        console.log('Recreating members table with UNIQUE(employee_id) and delegate_id...');
        
        const oldMembers = db.prepare('SELECT * FROM members').all();
        console.log(`Migrating ${oldMembers.length} members...`);

        db.exec('DROP TABLE IF EXISTS members_new');
        db.exec(`
            CREATE TABLE members_new (
                id TEXT PRIMARY KEY,
                socio_id TEXT,
                employee_id TEXT UNIQUE,
                full_name TEXT NOT NULL,
                member_type TEXT CHECK(member_type IN ('SECRETARIO_GENERAL', 'ACTIVO', 'ESPERA', 'PENSIONADO', 'BAJA', 'OTRO', 'DELEGADO')),
                status TEXT,
                position TEXT,
                department TEXT,
                secretariat TEXT,
                curp TEXT,
                rfc TEXT,
                birth_date TEXT,
                birth_place TEXT,
                age INTEGER,
                gender TEXT,
                address TEXT,
                colonia TEXT,
                municipio TEXT,
                cp TEXT,
                email TEXT,
                phone TEXT,
                emergency_contact TEXT,
                emergency_phone TEXT,
                emergency_relationship TEXT,
                education TEXT,
                blood_type TEXT,
                marital_status TEXT,
                spouse_name TEXT,
                photo_url TEXT,
                join_date TEXT,
                alta_sindicato TEXT,
                fecha_baja TEXT,
                delegate_id TEXT,
                delegate_name_legacy TEXT,
                clinic TEXT,
                shift TEXT,
                salary REAL,
                bonos REAL,
                bono_asistencia REAL,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (delegate_id) REFERENCES delegates(id)
            )
        `);

        const insert = db.prepare(`
            INSERT INTO members_new (
                id, socio_id, employee_id, full_name, member_type, status, position,
                department, secretariat, curp, rfc, birth_date, birth_place, age, gender,
                address, colonia, municipio, cp, email, phone,
                emergency_contact, emergency_phone, emergency_relationship,
                education, blood_type, marital_status, spouse_name,
                photo_url, join_date, alta_sindicato, fecha_baja, delegate_id, delegate_name_legacy,
                clinic, shift, salary, bonos, bono_asistencia, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let matched = 0;
        oldMembers.forEach(m => {
            const delegateId = findDelegateId(m.delegate);
            if (delegateId) matched++;
            
            insert.run(
                m.id, m.socio_id, m.employee_id, m.full_name, m.member_type, m.status, m.position,
                m.department, m.secretariat, m.curp, m.rfc, m.birth_date, m.birth_place, m.age, m.gender,
                m.address, m.colonia, m.municipio, m.cp, m.email, m.phone,
                m.emergency_contact, m.emergency_phone, m.emergency_relationship,
                m.education, m.blood_type, m.marital_status, m.spouse_name,
                m.photo_url, m.join_date, m.alta_sindicato, m.fecha_baja, delegateId, m.delegate,
                m.clinic, m.shift, m.salary, m.bonos, m.bono_asistencia, m.last_updated
            );
        });

        console.log(`Matched ${matched} delegates to their catalog entries.`);

        db.exec('DROP TABLE members');
        db.exec('ALTER TABLE members_new RENAME TO members');
        
        db.exec('CREATE INDEX idx_member_socio ON members(socio_id)');
        db.exec('CREATE INDEX idx_member_employee ON members(employee_id)');
        db.exec('CREATE INDEX idx_member_delegate ON members(delegate_id)');
    })();

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error);
} finally {
    db.close();
}
