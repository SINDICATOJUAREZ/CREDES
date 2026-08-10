const Database = require('better-sqlite3');
const xlsx = require('xlsx');

const excelPath = 'I:\\APLICACIONES\\SINDICATO\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const dbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\database.sqlite';

const workbook = xlsx.readFile(excelPath);
const db = new Database(dbPath);

console.log('=== AUDITORÍA DE CALIDAD Y UNICIDAD EN SQLite ===');

// 1. Verificar duplicados de employee_id
const empDupes = db.prepare(`
  SELECT employee_id, COUNT(*) as cnt 
  FROM members 
  WHERE employee_id IS NOT NULL AND employee_id != '' 
  GROUP BY employee_id 
  HAVING cnt > 1
`).all();

console.log('Duplicados por employee_id en DB:', empDupes.length);
if (empDupes.length > 0) {
  console.log('ALERT: Duplicados encontrados por employee_id:', empDupes);
}

// 2. Verificar duplicados de CURP
const curpDupes = db.prepare(`
  SELECT curp, COUNT(*) as cnt 
  FROM members 
  WHERE curp IS NOT NULL AND curp != '' 
  GROUP BY curp 
  HAVING cnt > 1
`).all();

console.log('Duplicados por CURP en DB:', curpDupes.length);
if (curpDupes.length > 0) {
  console.log('ALERT: Duplicados encontrados por CURP:', curpDupes);
}

// 3. Muestra de miembros en Lista de Espera en la DB
const sampleWaitlist = db.prepare("SELECT employee_id, socio_id, full_name, member_type, status, alta_sindicato, department, position, curp FROM members WHERE member_type = 'LISTA DE ESPERA' LIMIT 10").all();
console.log('\nMuestra de 10 miembros en Lista de Espera en la DB:');
console.table(sampleWaitlist);

// 4. Muestra de miembros nuevos insertados (que vienen de Etapa 16 o BD Pendientes)
const sampleNewInserts = db.prepare("SELECT employee_id, socio_id, full_name, member_type, status, alta_sindicato, department, position FROM members WHERE member_type = 'LISTA DE ESPERA' AND socio_id = 'ETAPA 16' LIMIT 5").all();
console.log('\nMuestra de miembros insertados provenientes de ETAPA 16:');
console.table(sampleNewInserts);

db.close();
