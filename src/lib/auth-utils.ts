import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  permissions?: {
    canCreateMember?: boolean;
    canSearchMember?: boolean;
    canViewReports?: boolean;
    canViewMemberReports?: boolean;
    canViewPensioners?: boolean;
    canAccessSettings?: boolean;
  };
}

export async function getSessionUser(): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'sindicato-secret-key-2026');
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as UserPayload;
  } catch (error) {
    return null;
  }
}

export async function hasPermission(permission: keyof Required<UserPayload>['permissions']): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.role === 'MASTER') return true; // MASTER has all permissions bypass
  return !!user.permissions?.[permission];
}
