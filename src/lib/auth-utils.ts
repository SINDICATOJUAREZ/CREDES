import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isProduction, sSelectOne } from './supabase';
import path from 'path';

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  permissions?: Record<string, boolean>;
}

async function fetchFreshUserAndPermissions(email: string) {
  try {
    if (isProduction) {
      const user = await sSelectOne('users', `select=*,roles!role_id(name,can_create_member,can_search_member,can_print_credentials,can_view_reports,can_view_birthdays,can_view_member_reports,can_view_complaints,can_view_pensioners,can_access_settings)&email=eq.${encodeURIComponent(email)}&is_active=eq.1`);
      if (user) {
        return {
          role: user.roles?.name || '',
          permissions: {
            canCreateMember: !!user.roles?.can_create_member,
            canSearchMember: !!user.roles?.can_search_member,
            canPrintCredentials: user.roles?.can_print_credentials !== undefined ? !!user.roles?.can_print_credentials : true,
            canViewReports: !!user.roles?.can_view_reports,
            canViewBirthdays: !!user.roles?.can_view_birthdays,
            canViewMemberReports: !!user.roles?.can_view_member_reports,
            canViewComplaints: !!user.roles?.can_view_complaints,
            canViewPensioners: !!user.roles?.can_view_pensioners,
            canAccessSettings: !!user.roles?.can_access_settings,
          }
        };
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      
      try {
        db.prepare('SELECT can_view_birthdays FROM roles LIMIT 1').get();
      } catch {
        db.exec('ALTER TABLE roles ADD COLUMN can_view_birthdays INTEGER DEFAULT 1');
      }
      try {
        db.prepare('SELECT can_view_complaints FROM roles LIMIT 1').get();
      } catch {
        db.exec('ALTER TABLE roles ADD COLUMN can_view_complaints INTEGER DEFAULT 1');
      }
      try {
        db.prepare('SELECT can_print_credentials FROM roles LIMIT 1').get();
      } catch {
        db.exec('ALTER TABLE roles ADD COLUMN can_print_credentials INTEGER DEFAULT 1');
      }

      const user = db.prepare(`
        SELECT u.email, r.name as role_name, r.can_create_member, r.can_search_member, r.can_print_credentials, r.can_view_reports, r.can_view_birthdays, r.can_view_member_reports, r.can_view_complaints, r.can_view_pensioners, r.can_access_settings 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.email = ? AND u.is_active = 1
      `).get(email) as any;
      db.close();
      if (user) {
        return {
          role: user.role_name,
          permissions: {
            canCreateMember: !!user.can_create_member,
            canSearchMember: !!user.can_search_member,
            canPrintCredentials: user.can_print_credentials !== undefined ? !!user.can_print_credentials : true,
            canViewReports: !!user.can_view_reports,
            canViewBirthdays: !!user.can_view_birthdays,
            canViewMemberReports: !!user.can_view_member_reports,
            canViewComplaints: !!user.can_view_complaints,
            canViewPensioners: !!user.can_view_pensioners,
            canAccessSettings: !!user.can_access_settings,
          }
        };
      }
    }
  } catch (error) {
    console.error('Error fetching fresh user and permissions:', error);
  }
  return null;
}

export async function getSessionUser(): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'sindicato-secret-key-2026');
    const { payload } = await jwtVerify(token, secret);
    const userPayload = payload as unknown as UserPayload;

    // Load fresh permissions and role name directly from database
    const freshData = await fetchFreshUserAndPermissions(userPayload.email);
    if (freshData) {
      return {
        ...userPayload,
        role: freshData.role,
        permissions: freshData.permissions,
      };
    }

    return userPayload;
  } catch (error) {
    return null;
  }
}

export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.role === 'MASTER') return true; // MASTER role bypasses all checks
  return !!user.permissions?.[permission];
}
