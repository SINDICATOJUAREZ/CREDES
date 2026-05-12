const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

async function setup() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    
    try {
        db.prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@sutsmbj.gob.mx'").run(hash);
        console.log("Master user password hashed successfully.");
    } catch (err) {
        console.error("Error updating master user:", err);
    } finally {
        db.close();
    }
}

setup();
