const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

const check = db.prepare("SELECT employee_id, full_name, member_type FROM members WHERE employee_id IN ('6435', '6586')").all();
console.log(JSON.stringify(check, null, 2));

const allTypes = db.prepare("SELECT DISTINCT member_type FROM members").all();
console.log("\nAll unique member types in DB:");
console.log(JSON.stringify(allTypes, null, 2));

db.close();
