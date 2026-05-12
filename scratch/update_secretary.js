const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('database.sqlite');

console.log('--- BUSCANDO A LEONARDO REYES FLORES ---');
const member = db.prepare("SELECT * FROM members WHERE employee_id = '5058'").get();
console.log(member);

if (member) {
  console.log('\n--- ACTUALIZANDO A SECRETARIO GENERAL ---');
  const result = db.prepare("UPDATE members SET member_type = 'SECRETARIO_GENERAL' WHERE employee_id = '5058'").run();
  console.log('Filas actualizadas:', result.changes);
  
  const updated = db.prepare("SELECT * FROM members WHERE employee_id = '5058'").get();
  console.log('\n--- DATOS ACTUALIZADOS ---');
  console.log(updated);
} else {
  console.log('No se encontró al agremiado con nómina 5058');
}

db.close();
