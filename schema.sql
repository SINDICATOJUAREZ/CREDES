-- Database schema for Sindicato Juarez N.L.

-- Table: members (Agremiados)
CREATE TABLE IF NOT EXISTS members (
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
);


-- Table: delegates (Catalogo de delegados)
CREATE TABLE IF NOT EXISTS delegates (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    department TEXT,
    type TEXT
);

-- Table: family_members (Beneficiarios)
CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    relationship TEXT,
    birth_date TEXT,
    age INTEGER,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- =============================================
-- RBAC: Roles y Permisos
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    can_create_member INTEGER DEFAULT 0,
    can_search_member INTEGER DEFAULT 0,
    can_view_reports INTEGER DEFAULT 0,
    can_view_pensioners INTEGER DEFAULT 0,
    can_access_settings INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Usuarios del sistema
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id TEXT,
    is_active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- =============================================
-- Diseñador de Credenciales
-- =============================================
CREATE TABLE IF NOT EXISTS credential_designs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    section TEXT DEFAULT 'frente',
    background_url TEXT,
    primary_color TEXT DEFAULT '#003366',
    secondary_color TEXT DEFAULT '#EAB308',
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visual_elements (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL,
    campo_bd TEXT NOT NULL,
    label TEXT,
    tipo TEXT DEFAULT 'texto',
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    w REAL DEFAULT 10,
    h REAL DEFAULT 3,
    color TEXT DEFAULT '#000000',
    font_size INTEGER DEFAULT 8,
    font_weight TEXT DEFAULT 'bold',
    alignment TEXT DEFAULT 'left',
    is_visible INTEGER DEFAULT 1,
    fixed_text TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (design_id) REFERENCES credential_designs(id) ON DELETE CASCADE
);

-- =============================================
-- Configuración Global del Sistema
-- =============================================
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Log de Auditoría
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =============================================
-- Datos Iniciales: Roles por defecto
-- =============================================
INSERT OR IGNORE INTO roles (id, name, description, can_create_member, can_search_member, can_view_reports, can_view_pensioners, can_access_settings)
VALUES
  ('role-master', 'MASTER', 'Administrador Supremo', 1, 1, 1, 1, 1),
  ('role-admin', 'ADMINISTRADOR', 'Alta, baja y modificaciones', 1, 1, 1, 1, 0),
  ('role-capturista', 'CAPTURISTA', 'Permisos de Alta y Edición', 1, 1, 0, 0, 0),
  ('role-consulta', 'CONSULTA', 'Solo lectura', 0, 1, 1, 1, 0);

-- =============================================
-- Datos Iniciales: Usuario MASTER por defecto
-- password: admin123 (bcrypt sería ideal, usamos sha256 placeholder)
-- =============================================
INSERT OR IGNORE INTO users (id, full_name, email, password_hash, role_id, is_active)
VALUES ('user-master', 'Administrador', 'admin@sutsmbj.gob.mx', 'admin123', 'role-master', 1);

-- =============================================
-- Diseño de Credencial por defecto
-- =============================================
INSERT OR IGNORE INTO credential_designs (id, name, section, primary_color, secondary_color, is_active)
VALUES ('design-default', 'Plantilla Institucional', 'frente', '#003366', '#EAB308', 1);

INSERT OR IGNORE INTO visual_elements (id, design_id, campo_bd, label, tipo, x, y, w, h, color, font_size, font_weight, is_visible, sort_order)
VALUES
  ('ve-1', 'design-default', 'fullName',     'Nombre',   'texto',  0, 0, 30, 3, '#003366', 10, 'black', 1, 1),
  ('ve-2', 'design-default', 'employeeId',   'Nómina',   'texto',  0, 7, 20, 3, '#1F2937', 8,  'bold',  1, 2),
  ('ve-3', 'design-default', 'position',     'Puesto',   'texto',  0, 13, 30, 3, '#1F2937', 8,  'bold',  1, 3),
  ('ve-4', 'design-default', 'socioId',      'Socio',    'texto',  0, 30, 15, 3, '#FFFFFF', 6,  'black', 1, 4),
  ('ve-5', 'design-default', 'qr',           'QR',       'qr',     35, 20, 10, 10,'#000000', 36, 'normal',1, 5),
  ('ve-6', 'design-default', 'memberType',   'Tipo',     'texto',  0, 20, 20, 3, '#EAB308', 7,  'black', 1, 6);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_socio ON members(socio_id);
CREATE INDEX IF NOT EXISTS idx_member_employee ON members(employee_id);
CREATE INDEX IF NOT EXISTS idx_family_member ON family_members(member_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_ve_design ON visual_elements(design_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

-- =============================================
-- Asistencias a Eventos
-- =============================================
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
