/**
 * Utility for mapping between database (snake_case) and frontend (camelCase)
 */

export const MEMBER_MAPPING: Record<string, string> = {
  id: 'id',
  socio_id: 'socioId',
  employee_id: 'employeeId',
  full_name: 'fullName',
  member_type: 'memberType',
  status: 'status',
  position: 'position',
  department: 'department',
  secretariat: 'secretariat',
  curp: 'curp',
  rfc: 'rfc',
  birth_date: 'birthDate',
  birth_place: 'birthPlace',
  age: 'age',
  gender: 'gender',
  address: 'address',
  colonia: 'colonia',
  municipio: 'municipio',
  cp: 'cp',
  email: 'email',
  phone: 'phone',
  emergency_contact: 'emergencyContact',
  emergency_phone: 'emergencyPhone',
  emergency_relationship: 'emergencyRelationship',
  education: 'education',
  blood_type: 'bloodType',
  marital_status: 'maritalStatus',
  spouse_name: 'spouseName',
  photo_url: 'photoUrl',
  join_date: 'joinDate',
  alta_sindicato: 'altaSindicato',
  fecha_baja: 'fechaBaja',
  delegate_id: 'delegateId',
  clinic: 'clinic',
  shift: 'shift',
  salary: 'salary',
  bonos: 'bonos',
  bono_asistencia: 'bonoAsistencia',
  last_updated: 'lastUpdated'
};

export const DELEGATE_MAPPING: Record<string, string> = {
  id: 'id',
  employee_id: 'employeeId',
  full_name: 'fullName',
  phone: 'phone',
  department: 'department',
  type: 'type'
};

/**
 * Maps a database row to a frontend object
 */
export function mapToFrontend(row: any, mapping: Record<string, string>) {
  if (!row) return null;
  const result: any = {};
  for (const [dbKey, fsKey] of Object.entries(mapping)) {
    result[fsKey] = row[dbKey];
  }
  return result;
}

/**
 * Maps a frontend object to database values for INSERT/UPDATE
 */
export function mapToDb(obj: any, mapping: Record<string, string>) {
  const result: any = {};
  for (const [dbKey, fsKey] of Object.entries(mapping)) {
    if (obj[fsKey] !== undefined) {
      result[dbKey] = obj[fsKey];
    }
  }
  return result;
}

/**
 * Generates an INSERT statement dynamically
 */
export function generateInsert(table: string, mapping: Record<string, string>, data: any) {
  const dbData = mapToDb(data, mapping);
  const keys = Object.keys(dbData);
  const values = keys.map(() => '?');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')})`;
  return { sql, params: Object.values(dbData) };
}

/**
 * Generates an UPDATE statement dynamically
 */
export function generateUpdate(table: string, mapping: Record<string, string>, data: any, idField = 'id') {
  const { [idField]: id, ...rest } = data;
  const dbData = mapToDb(rest, mapping);
  const keys = Object.keys(dbData);
  const sets = keys.map(k => `${k} = ?`);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idField} = ?`;
  return { sql, params: [...Object.values(dbData), id] };
}
