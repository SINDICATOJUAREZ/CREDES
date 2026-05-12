export interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age?: number;
  isDependent: boolean;
}

export interface Delegate {
  id: string;
  employeeId: string;
  fullName: string;
  phone?: string;
  department?: string;
  type?: string;
}

export interface VisualElement {
  id: string;
  label: string;
  field: keyof Member | 'fixed_text';
  type: 'text' | 'image' | 'qr';
  x: number; // position in mm
  y: number; // position in mm
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'black';
  color: string;
  isVisible: boolean;
  fixedText?: string;
}

export interface CredentialConfig {
  id: string;
  name: string;
  elements: VisualElement[];
  backgroundUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  showTemplate?: boolean;
}

export interface Member {
  id: string;
  socioId?: string;
  employeeId?: string;
  fullName: string;
  memberType: 'SECRETARIO_GENERAL' | 'ACTIVO' | 'ESPERA' | 'PENSIONADO' | 'BAJA' | 'OTRO' | 'DELEGADO';
  status?: string;
  position?: string;
  department?: string; // DIRECCION in Excel
  secretariat?: string; // SECRETARIA in Excel
  curp?: string;
  rfc?: string;
  birthDate?: string;
  birthPlace?: string;
  age?: number;
  gender?: string;
  address?: string;
  colonia?: string;
  municipio?: string;
  cp?: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  emergencyRelationship?: string;
  education?: string;
  bloodType?: string;
  maritalStatus?: string;
  spouseName?: string;
  photoUrl?: string;
  joinDate?: string; // FECHA DE INGRESO
  altaSindicato?: string;
  fechaBaja?: string;
  delegate?: string;
  clinic?: string;
  shift?: string;
  salary?: number;
  bonos?: number;
  bonoAsistencia?: number;
  
  // Relations
  family: FamilyMember[];
  
  // App specific
  qrData?: string;
  expiryDate?: string;
}

// =============================================
// Settings Types
// =============================================

export interface Role {
  id: string;
  name: string;
  description: string;
  can_create_member: boolean;
  can_search_member: boolean;
  can_view_reports: boolean;
  can_view_pensioners: boolean;
  can_access_settings: boolean;
  userCount?: number;
}

export interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  password?: string;
  role_id: string;
  role_name?: string;
  role_description?: string;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
}

export interface DbVisualElement {
  id: string;
  design_id: string;
  campo_bd: string;
  label: string;
  tipo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  font_size: number;
  font_weight: string;
  alignment: string;
  is_visible: boolean;
  fixed_text?: string;
  sort_order: number;
}

export interface CredentialDesign {
  id: string;
  name: string;
  section: string;
  background_url?: string;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  show_template?: boolean;
  elements: DbVisualElement[];
}
