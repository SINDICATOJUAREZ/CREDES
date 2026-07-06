import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { isProduction, sSelectOne } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    let user: any = null;

    if (isProduction) {
      user = await sSelectOne('users', `select=*,roles!role_id(name,can_create_member,can_search_member,can_view_reports,can_view_birthdays,can_view_member_reports,can_view_complaints,can_view_pensioners,can_access_settings)&email=eq.${encodeURIComponent(email)}&is_active=eq.1`);
      if (user) {
        user.role_name = user.roles?.name;
        user.can_create_member = user.roles?.can_create_member;
        user.can_search_member = user.roles?.can_search_member;
        user.can_view_reports = user.roles?.can_view_reports;
        user.can_view_birthdays = user.roles?.can_view_birthdays;
        user.can_view_member_reports = user.roles?.can_view_member_reports;
        user.can_view_complaints = user.roles?.can_view_complaints;
        user.can_view_pensioners = user.roles?.can_view_pensioners;
        user.can_access_settings = user.roles?.can_access_settings;
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
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

      user = db.prepare('SELECT u.*, r.name as role_name, r.can_create_member, r.can_search_member, r.can_view_reports, r.can_view_birthdays, r.can_view_member_reports, r.can_view_complaints, r.can_view_pensioners, r.can_access_settings FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.is_active = 1').get(email);
      db.close();
    }

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'sindicato-secret-key-2026');
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role_name,
      fullName: user.full_name,
      permissions: {
        canCreateMember: !!user.can_create_member,
        canSearchMember: !!user.can_search_member,
        canViewReports: !!user.can_view_reports,
        canViewBirthdays: !!user.can_view_birthdays,
        canViewMemberReports: !!user.can_view_member_reports,
        canViewComplaints: !!user.can_view_complaints,
        canViewPensioners: !!user.can_view_pensioners,
        canAccessSettings: !!user.can_access_settings,
      }
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_name,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
