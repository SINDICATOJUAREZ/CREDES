const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tables = [
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
    can_view_members INTEGER DEFAULT 0, can_create_members INTEGER DEFAULT 0,
    can_edit_members INTEGER DEFAULT 0, can_delete_members INTEGER DEFAULT 0,
    can_print_credentials INTEGER DEFAULT 0, can_export_data INTEGER DEFAULT 0,
    can_manage_users INTEGER DEFAULT 0, can_config_system INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role_id TEXT, is_active INTEGER DEFAULT 1,
    last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id))`,
  `CREATE TABLE IF NOT EXISTS credential_designs (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, section TEXT DEFAULT 'frente',
    background_url TEXT, primary_color TEXT DEFAULT '#003366',
    secondary_color TEXT DEFAULT '#EAB308', is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS visual_elements (
    id TEXT PRIMARY KEY, design_id TEXT NOT NULL, campo_bd TEXT NOT NULL,
    label TEXT, tipo TEXT DEFAULT 'texto', x REAL DEFAULT 0, y REAL DEFAULT 0,
    w REAL DEFAULT 10, h REAL DEFAULT 3, color TEXT DEFAULT '#000000',
    font_size INTEGER DEFAULT 8, font_weight TEXT DEFAULT 'bold',
    alignment TEXT DEFAULT 'left', is_visible INTEGER DEFAULT 1,
    fixed_text TEXT, sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (design_id) REFERENCES credential_designs(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, detail TEXT,
    ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id))`
];

tables.forEach(t => db.exec(t));

db.exec(`INSERT OR IGNORE INTO roles (id,name,description,can_view_members,can_create_members,can_edit_members,can_delete_members,can_print_credentials,can_export_data,can_manage_users,can_config_system) VALUES
  ('role-master','MASTER','Administrador Supremo',1,1,1,1,1,1,1,1),
  ('role-admin','ADMINISTRADOR','Alta, baja y modificaciones',1,1,1,1,1,1,0,0),
  ('role-capturista','CAPTURISTA','Permisos de Alta y Edición',1,1,1,0,1,0,0,0),
  ('role-consulta','CONSULTA','Solo lectura',1,0,0,0,0,0,0,0)`);

db.exec(`INSERT OR IGNORE INTO users (id,full_name,email,password_hash,role_id,is_active) VALUES ('user-master','Administrador','admin@sutsmbj.gob.mx','admin123','role-master',1)`);

db.exec(`INSERT OR IGNORE INTO credential_designs (id,name,section,primary_color,secondary_color,is_active) VALUES ('design-default','Plantilla Institucional','frente','#003366','#EAB308',1)`);
db.exec(`INSERT OR IGNORE INTO visual_elements (id,design_id,campo_bd,label,tipo,x,y,w,h,color,font_size,font_weight,is_visible,sort_order) VALUES
  ('ve-1','design-default','fullName','Nombre','texto',0,0,30,3,'#003366',10,'black',1,1),
  ('ve-2','design-default','employeeId','Nómina','texto',0,7,20,3,'#1F2937',8,'bold',1,2),
  ('ve-3','design-default','position','Puesto','texto',0,13,30,3,'#1F2937',8,'bold',1,3),
  ('ve-4','design-default','socioId','Socio','texto',0,30,15,3,'#FFFFFF',6,'black',1,4),
  ('ve-5','design-default','qr','QR','qr',35,20,10,10,'#000000',36,'normal',1,5),
  ('ve-6','design-default','memberType','Tipo','texto',0,20,20,3,'#EAB308',7,'black',1,6)`);

db.exec('CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)');
db.exec('CREATE INDEX IF NOT EXISTS idx_user_role ON users(role_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ve_design ON visual_elements(design_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at)');

const roles = db.prepare('SELECT * FROM roles').all();
const users = db.prepare('SELECT id,full_name,email,role_id FROM users').all();
const designs = db.prepare('SELECT * FROM credential_designs').all();
const elements = db.prepare('SELECT * FROM visual_elements').all();
console.log('Migration complete.');
console.log('Roles:', roles.length);
console.log('Users:', users.length);
console.log('Designs:', designs.length);
console.log('Elements:', elements.length);
db.close();
