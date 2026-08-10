const xlsx = require('xlsx');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local si existen
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Configurada (' + supabaseUrl + ')' : 'NO configurada');
console.log('Supabase Key:', supabaseKey ? 'Configurada' : 'NO configurada');

const excelPath = 'I:\\APLICACIONES\\SINDICATO\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const dbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\database.sqlite';

const workbook = xlsx.readFile(excelPath);
const db = new Database(dbPath);

const dbMembers = db.prepare('SELECT * FROM members').all();

const dbByEmpId = new Map();
const dbByCurp = new Map();
const dbByName = new Map();

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return str;
}

dbMembers.forEach(m => {
  if (m.employee_id) dbByEmpId.set(String(m.employee_id).trim(), m);
  if (m.curp) dbByCurp.set(String(m.curp).trim().toUpperCase(), m);
  const norm = normalizeName(m.full_name);
  if (norm) dbByName.set(norm, m);
});

// 1. Pestaña BASE DE DATOS (ALTA SINDICATO == PENDIENTE)
const bdSheet = workbook.Sheets['BASE DE DATOS'];
const bdRows = xlsx.utils.sheet_to_json(bdSheet, { defval: '' });
const altaCol = Object.keys(bdRows[0] || {}).find(k => k.trim().toUpperCase().includes('ALTA') && k.trim().toUpperCase().includes('SINDICATO')) || 'ALTA SINDICATO';
const bdPendientes = bdRows.filter(r => String(r[altaCol] || '').trim().toUpperCase() === 'PENDIENTE');

// 2. Pestaña ETAPA 16 EN ESPERA
const e16Sheet = workbook.Sheets['ETAPA 16 EN ESPERA'];
const e16Rows = xlsx.utils.sheet_to_json(e16Sheet, { defval: '' });
const e16Lista = e16Rows.filter(r => String(r['# EMPLEADO'] || '').trim() !== '' || String(r['NOMBRE COMPLETO'] || '').trim() !== '');

// Consolidar registros sin duplicados
const unifiedWaitlist = [];
const processedKeys = new Set();

bdPendientes.forEach(r => {
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  const curp = String(r['CURP'] || '').trim().toUpperCase();
  const key = empId ? `EMP:${empId}` : (curp ? `CURP:${curp}` : `NAME:${normalizeName(name)}`);

  if (!processedKeys.has(key)) {
    processedKeys.add(key);
    unifiedWaitlist.push({
      source: 'BASE DE DATOS',
      employee_id: empId || null,
      socio_id: String(r['# SOCIO'] || '').trim() || null,
      full_name: name,
      department: String(r['DIRECCION'] || r['SECRETARIA'] || '').trim() || null,
      position: String(r['PUESTO'] || '').trim() || null,
      secretariat: String(r['SECRETARIA'] || '').trim() || null,
      curp: curp || null,
      rfc: String(r['RFC'] || '').trim().toUpperCase() || null,
      birth_date: parseExcelDate(r['FECHA DE NACIMIENTO']),
      birth_place: String(r['LUGAR DE NACIMIENTO'] || '').trim() || null,
      age: parseInt(r['EDAD']) || null,
      gender: String(r['SEXO'] || '').trim().toUpperCase() || null,
      address: String(r['DOMICILIO'] || '').trim() || null,
      colonia: String(r['COLONIA'] || '').trim() || null,
      municipio: String(r['MUNICIPIO'] || '').trim() || null,
      cp: String(r['C.P.'] || '').trim() || null,
      email: String(r['CORREO ELECTRONICO'] || '').trim() || null,
      phone: String(r['CELULAR'] || r['TEL. CASA'] || '').trim() || null,
      emergency_phone: String(r['TEL. RECADOS O EMERGENCIAS'] || '').trim() || null,
      emergency_contact: String(r['NOMBRE A QUIEN LLAMAR EN CASO DE EMERGENCIA'] || '').trim() || null,
      education: String(r['ESCOLARIDAD'] || '').trim() || null,
      blood_type: String(r['TIPO DE SANGRE'] || '').trim() || null,
      marital_status: String(r['EDO. CIVIL'] || '').trim() || null,
      spouse_name: String(r['NOMBRE DE ESPOS@'] || '').trim() || null,
      join_date: parseExcelDate(r['FECHA DE INGRESO']),
      alta_sindicato: 'PENDIENTE',
      fecha_baja: parseExcelDate(r['FECHA DE BAJA']),
      status: String(r['STATUS'] || 'PENDIENTE').trim().toUpperCase(),
      delegate_id: String(r['DELEGADO'] || '').trim() || null
    });
  }
});

e16Lista.forEach(r => {
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  const key = empId ? `EMP:${empId}` : `NAME:${normalizeName(name)}`;

  if (!processedKeys.has(key)) {
    processedKeys.add(key);
    unifiedWaitlist.push({
      source: 'ETAPA 16 EN ESPERA',
      employee_id: empId || null,
      socio_id: 'ETAPA 16',
      full_name: name,
      department: String(r['DEPENDENCIA'] || '').trim() || null,
      position: String(r['PUESTO'] || '').trim() || null,
      secretariat: String(r['DEPENDENCIA'] || '').trim() || null,
      curp: null,
      rfc: null,
      birth_date: null,
      birth_place: null,
      age: null,
      gender: null,
      address: null,
      colonia: null,
      municipio: null,
      cp: null,
      email: null,
      phone: null,
      emergency_phone: null,
      emergency_contact: null,
      education: null,
      blood_type: null,
      marital_status: null,
      spouse_name: null,
      join_date: null,
      alta_sindicato: 'PENDIENTE',
      fecha_baja: null,
      status: String(r['ESTATUS'] || 'PENDIENTE').trim().toUpperCase() || 'PENDIENTE',
      delegate_id: null
    });
  }
});

console.log(`\n=== EMPATANDO Y ACTUALIZANDO ${unifiedWaitlist.length} REGISTROS DE LISTA DE ESPERA ===`);

// Preparar sentencias SQL
const updateStmt = db.prepare(`
  UPDATE members SET
    member_type = 'LISTA DE ESPERA',
    alta_sindicato = 'PENDIENTE',
    socio_id = COALESCE(?, socio_id),
    department = COALESCE(?, department),
    position = COALESCE(?, position),
    secretariat = COALESCE(?, secretariat),
    curp = COALESCE(?, curp),
    rfc = COALESCE(?, rfc),
    birth_date = COALESCE(?, birth_date),
    birth_place = COALESCE(?, birth_place),
    age = COALESCE(?, age),
    gender = COALESCE(?, gender),
    address = COALESCE(?, address),
    colonia = COALESCE(?, colonia),
    municipio = COALESCE(?, municipio),
    cp = COALESCE(?, cp),
    email = COALESCE(?, email),
    phone = COALESCE(?, phone),
    emergency_phone = COALESCE(?, emergency_phone),
    emergency_contact = COALESCE(?, emergency_contact),
    education = COALESCE(?, education),
    blood_type = COALESCE(?, blood_type),
    marital_status = COALESCE(?, marital_status),
    spouse_name = COALESCE(?, spouse_name),
    join_date = COALESCE(?, join_date),
    fecha_baja = COALESCE(?, fecha_baja),
    status = COALESCE(?, status),
    delegate_id = COALESCE(?, delegate_id),
    last_updated = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO members (
    id, socio_id, employee_id, full_name, member_type, status,
    position, department, secretariat, curp, rfc, birth_date,
    birth_place, age, gender, address, colonia, municipio, cp,
    email, phone, emergency_contact, emergency_phone, education,
    blood_type, marital_status, spouse_name, join_date, alta_sindicato,
    fecha_baja, delegate_id, last_updated
  ) VALUES (
    ?, ?, ?, ?, 'LISTA DE ESPERA', ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, 'PENDIENTE',
    ?, ?, CURRENT_TIMESTAMP
  )
`);

let sqliteUpdates = 0;
let sqliteInserts = 0;
const recordsForSupabase = [];

const syncTx = db.transaction(() => {
  unifiedWaitlist.forEach(item => {
    const empId = item.employee_id;
    const name = item.full_name;
    const curp = item.curp;

    let existing = null;
    if (empId && dbByEmpId.has(empId)) {
      existing = dbByEmpId.get(empId);
    } else if (curp && dbByCurp.has(curp)) {
      existing = dbByCurp.get(curp);
    } else if (name && dbByName.has(normalizeName(name))) {
      existing = dbByName.get(normalizeName(name));
    }

    if (existing) {
      // UPDATE
      updateStmt.run(
        item.socio_id, item.department, item.position, item.secretariat,
        item.curp, item.rfc, item.birth_date, item.birth_place, item.age, item.gender,
        item.address, item.colonia, item.municipio, item.cp, item.email, item.phone,
        item.emergency_phone, item.emergency_contact, item.education, item.blood_type,
        item.marital_status, item.spouse_name, item.join_date, item.fecha_baja,
        item.status || existing.status || 'PENDIENTE', item.delegate_id,
        existing.id
      );
      sqliteUpdates++;
      recordsForSupabase.push({ type: 'UPDATE', id: existing.id, data: item });
    } else {
      // INSERT
      const newId = crypto.randomUUID();
      insertStmt.run(
        newId, item.socio_id, item.employee_id, item.full_name, item.status || 'PENDIENTE',
        item.position, item.department, item.secretariat, item.curp, item.rfc, item.birth_date,
        item.birth_place, item.age, item.gender, item.address, item.colonia, item.municipio, item.cp,
        item.email, item.phone, item.emergency_contact, item.emergency_phone, item.education,
        item.blood_type, item.marital_status, item.spouse_name, item.join_date,
        item.fecha_baja, item.delegate_id
      );
      sqliteInserts++;
      recordsForSupabase.push({ type: 'INSERT', id: newId, data: item });
    }
  });
});

syncTx();
console.log(`\n=== RESULTADO SQLITE ===`);
console.log(`SQLite Updates ejecutados: ${sqliteUpdates}`);
console.log(`SQLite Inserts ejecutados: ${sqliteInserts}`);

// Sincronizar hacia Supabase si las credenciales existen
async function syncToSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('\nSupabase no configurado, omitiendo sync REST.');
    return;
  }

  console.log('\n=== SINCRONIZANDO HACIA SUPABASE REST ===');
  let sbSuccess = 0;
  let sbErrors = 0;

  for (const rec of recordsForSupabase) {
    const d = rec.data;
    const payload = {
      socio_id: d.socio_id,
      employee_id: d.employee_id,
      full_name: d.full_name,
      member_type: 'LISTA DE ESPERA',
      status: d.status || 'PENDIENTE',
      position: d.position,
      department: d.department,
      secretariat: d.secretariat,
      curp: d.curp,
      rfc: d.rfc,
      birth_date: d.birth_date,
      birth_place: d.birth_place,
      age: d.age,
      gender: d.gender,
      address: d.address,
      colonia: d.colonia,
      municipio: d.municipio,
      cp: d.cp,
      email: d.email,
      phone: d.phone,
      emergency_contact: d.emergency_contact,
      emergency_phone: d.emergency_phone,
      education: d.education,
      blood_type: d.blood_type,
      marital_status: d.marital_status,
      spouse_name: d.spouse_name,
      join_date: d.join_date,
      alta_sindicato: 'PENDIENTE',
      fecha_baja: d.fecha_baja,
      delegate_id: d.delegate_id,
      last_updated: new Date().toISOString()
    };

    try {
      if (rec.type === 'INSERT') {
        payload.id = rec.id;
        const res = await fetch(`${supabaseUrl}/rest/v1/members`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error(`Error Supabase INSERT ${rec.id}:`, txt);
          sbErrors++;
        } else {
          sbSuccess++;
        }
      } else {
        // UPDATE
        const res = await fetch(`${supabaseUrl}/rest/v1/members?id=eq.${rec.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error(`Error Supabase UPDATE ${rec.id}:`, txt);
          sbErrors++;
        } else {
          sbSuccess++;
        }
      }
    } catch (err) {
      console.error(`Excepción Supabase (${rec.id}):`, err.message);
      sbErrors++;
    }
  }

  console.log(`Sincronización Supabase completada: ${sbSuccess} exitosos, ${sbErrors} errores.`);
}

syncToSupabase().then(() => {
  // Verificar conteo final en DB
  const finalCount = db.prepare('SELECT COUNT(*) as total FROM members').get().total;
  const finalWaitlist = db.prepare("SELECT COUNT(*) as total FROM members WHERE member_type = 'LISTA DE ESPERA'").get().total;
  console.log(`\n=== ESTADO FINAL DE LA BASE DE DATOS ===`);
  console.log(`Total de miembros en la DB: ${finalCount}`);
  console.log(`Total miembros con member_type = 'LISTA DE ESPERA': ${finalWaitlist}`);

  db.close();
});
