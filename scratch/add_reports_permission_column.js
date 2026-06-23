const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
console.log('Connecting to database at:', DB_PATH);
const db = new Database(DB_PATH);

try {
  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(roles)").all();
  const hasColumn = tableInfo.some(col => col.name === 'can_view_member_reports');

  if (!hasColumn) {
    console.log("Adding column 'can_view_member_reports' to 'roles' table...");
    db.prepare("ALTER TABLE roles ADD COLUMN can_view_member_reports INTEGER DEFAULT 0").run();
    console.log("Column added successfully!");
  } else {
    console.log("Column 'can_view_member_reports' already exists in 'roles' table.");
  }

  // Update default roles
  console.log("Updating default roles permissions...");
  const updateStmt = db.prepare("UPDATE roles SET can_view_member_reports = 1 WHERE name IN ('MASTER', 'ADMINISTRADOR', 'CONSULTA')");
  const result = updateStmt.run();
  console.log(`Updated permissions for ${result.changes} roles.`);

  // Print current roles to verify
  const roles = db.prepare("SELECT name, can_create_member, can_search_member, can_view_reports, can_view_member_reports, can_view_pensioners, can_access_settings FROM roles").all();
  console.log("Current roles configuration:");
  console.log(roles);

} catch (error) {
  console.error("Migration failed:", error);
} finally {
  db.close();
}
