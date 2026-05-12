const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXCEL_PATH = 'I:/APLICACIONES/SINDICATO/CREDENCIALES/RECURSOS/BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const DB_PATH = 'i:/APLICACIONES/SINDICATO/CREDENCIALES/database.sqlite';
const FOTOS_DIR = 'I:/APLICACIONES/SINDICATO/CREDENCIALES/RECURSOS/FOTOS';

const db = new Database(DB_PATH);

// Initialize DB
const schema = fs.readFileSync('i:/APLICACIONES/SINDICATO/CREDENCIALES/schema.sql', 'utf8');
db.exec(schema);

const workbook = XLSX.readFile(EXCEL_PATH);

// Helper to get photo URL
const photos = fs.readdirSync(FOTOS_DIR);
function findPhoto(payroll, socio) {
    if (!payroll && !socio) return null;
    const matched = photos.find(f => 
        (payroll && f.startsWith(payroll + '.')) || 
        (socio && f.startsWith(socio + '.')) || 
        (payroll && f.includes(payroll))
    );
    return matched ? `/api/photos/${matched}` : null;
}

// Helper to parse currency strings from Excel
function parseCurrency(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = val.toString().replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// Helper to convert Excel serial dates to ISO strings
function excelDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    return val.toString().trim();
}

// 0. Import Delegates Catalog
console.log('Importing delegates...');
const delegateSheet = workbook.Sheets['DELEGADOS'];
const insertDelegate = db.prepare(`
    INSERT INTO delegates (id, employee_id, full_name, phone, department, type)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const delegateCatalog = []; // Array of {fullName, upperName}
if (delegateSheet) {
    const delegateData = XLSX.utils.sheet_to_json(delegateSheet, { header: 1 });
    db.transaction(() => {
        delegateData.slice(1).forEach(row => {
            const type = row[1]?.toString().trim(); // DELEGADO or SUBDELEGADO
            const payroll = row[2]?.toString().trim();
            const fullName = row[3]?.toString().trim();
            const phone = row[4]?.toString().trim();
            const department = row[5]?.toString().trim();
            
            if (fullName) {
                insertDelegate.run(crypto.randomUUID(), payroll, fullName, phone, department, type);
                delegateCatalog.push({
                    fullName: fullName,
                    upperName: fullName.toUpperCase()
                });
            }
        });
    })();
}

// Helper to find the best matching delegate from the catalog
function matchDelegate(name) {
    if (!name) return null;
    const searchName = name.toString().trim().toUpperCase();
    if (!searchName) return null;

    // 1. Try exact match
    let match = delegateCatalog.find(d => d.upperName === searchName);
    if (match) return match.fullName;

    // 2. Try prefix match (truncated name in main sheet)
    match = delegateCatalog.find(d => d.upperName.startsWith(searchName));
    if (match) return match.fullName;

    // 3. Try reverse prefix (catalog name in search name)
    match = delegateCatalog.find(d => searchName.startsWith(d.upperName));
    if (match) return match.fullName;

    // 4. Try containment
    match = delegateCatalog.find(d => d.upperName.includes(searchName));
    if (match) return match.fullName;

    return name.toString().trim();
}

// 1. Import Main Database
const mainSheet = workbook.Sheets['BASE DE DATOS'];
const mainData = XLSX.utils.sheet_to_json(mainSheet, { header: 1 });

const insertMember = db.prepare(`
    INSERT INTO members (
        id, socio_id, employee_id, full_name, member_type, status, position, 
        department, secretariat, curp, rfc, birth_date, birth_place, age, gender, 
        address, colonia, municipio, cp, email, phone, 
        emergency_contact, emergency_phone, education, blood_type, 
        marital_status, spouse_name, photo_url, join_date, alta_sindicato, fecha_baja, delegate, 
        salary, bonos, bono_asistencia
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
`);

const insertFamily = db.prepare(`
    INSERT INTO family_members (id, member_id, full_name, relationship)
    VALUES (?, ?, ?, ?)
`);

console.log('Importing main database (BASE DE DATOS)...');

db.transaction(() => {
    for (let i = 1; i < mainData.length; i++) {
        const row = mainData[i];
        const payroll = row[0]?.toString().trim();
        const socio = row[1]?.toString().trim();
        const fullName = row[2]?.toString().trim();
        
        if (!fullName) continue;

        const id = crypto.randomUUID();
        let memberStatus = row[6]?.toString().trim() || 'ACTIVO';
        let memberType = 'ACTIVO';
        if (memberStatus === 'PENSIONADO') memberType = 'PENSIONADO';
        if (memberStatus === 'BAJA') memberType = 'BAJA';
        
        const upperName = fullName.toUpperCase();
        if (upperName.includes('JAVIER RODRIGUEZ ROBLEDO')) {
             memberType = 'SECRETARIO_GENERAL';
        } else if (delegateCatalog.some(d => d.upperName === upperName)) {
            memberType = 'DELEGADO';
        }

        insertMember.run(
            id, socio, payroll, fullName, memberType, memberStatus, row[7]?.toString().trim(),
            row[8]?.toString().trim(), row[9]?.toString().trim(), row[10]?.toString().trim(), row[11]?.toString().trim(), excelDate(row[12]), 
            row[15]?.toString().trim(), row[14], row[34]?.toString().trim(), row[16]?.toString().trim(), row[17]?.toString().trim(), row[18]?.toString().trim(), 
            row[19]?.toString().trim(), row[20]?.toString().trim(), row[22]?.toString().trim() || row[21]?.toString().trim(),
            row[24]?.toString().trim(), row[23]?.toString().trim(),
            row[25]?.toString().trim(), row[26]?.toString().trim(), row[27]?.toString().trim(), row[28]?.toString().trim(),
            findPhoto(payroll, socio), excelDate(row[3]), excelDate(row[4]), excelDate(row[5]), 
            matchDelegate(row[39]),
            parseCurrency(row[36]),
            parseCurrency(row[37]),
            parseCurrency(row[38])
        );

        if (row[28]) {
            insertFamily.run(crypto.randomUUID(), id, row[28].toString().trim(), 'ESPOSO/A');
        }
        
        if (row[30]) {
            const childrenValue = row[30].toString();
            const children = childrenValue.split(',').map(s => s.trim());
            children.forEach(child => {
                if (child) insertFamily.run(crypto.randomUUID(), id, child, 'HIJO/A');
            });
        }
    }
})();

// 2. Import Wait List (ETAPA 16)
console.log('Importing wait list (ETAPA 16)...');
const waitSheet = workbook.Sheets['ETAPA 16'];
if (waitSheet) {
    const waitData = XLSX.utils.sheet_to_json(waitSheet, { header: 1 });
    db.transaction(() => {
        waitData.slice(1).forEach(row => {
            const payroll = row[1]?.toString().trim();
            const fullName = row[2]?.toString().trim();
            const department = row[3]?.toString().trim();
            const position = row[4]?.toString().trim();
            const status = row[5]?.toString().trim(); 

            if (!fullName || status === 'BAJA') return;

            insertMember.run(
                crypto.randomUUID(), null, payroll, fullName, 'ESPERA', 'LISTA DE ESPERA', position,
                department, null, null, null, null, null,
                null, null, null, null, null, 
                null, null, null,
                null, null, null, null, null, null,
                findPhoto(payroll, null), null, null, null, null, 0, 0, 0
            );
        });
    })();
}

console.log('Import complete.');
db.close();
