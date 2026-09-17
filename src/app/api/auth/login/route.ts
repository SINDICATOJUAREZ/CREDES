import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { isProduction, sSelectOne } from '@/lib/supabase';
import { loginRateLimiter } from '@/lib/rate-limiter';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown-ip';
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // Check rate limit: max 5 failed attempts in 15 minutes
  const rateLimitStatus = loginRateLimiter.check(clientIp);
  if (!rateLimitStatus.allowed) {
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Tu acceso está temporalmente bloqueado por seguridad. Intenta nuevamente en ${Math.ceil(
          rateLimitStatus.retryAfterSeconds / 60
        )} minutos.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitStatus.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Por favor proporciona correo y contraseña válidos.' },
        { status: 400 }
      );
    }

    // Protection against bcrypt DoS (bcrypt truncates after 72 bytes anyway)
    if (password.length > 72 || email.length > 255) {
      loginRateLimiter.recordFailure(clientIp);
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' },
        { status: 401 }
      );
    }

    let user: any = null;

    if (isProduction) {
      user = await sSelectOne(
        'users',
        `select=*,roles!role_id(name,can_create_member,can_search_member,can_print_credentials,can_view_reports,can_view_birthdays,can_view_member_reports,can_view_complaints,can_view_pensioners,can_access_settings)&email=eq.${encodeURIComponent(
          email
        )}&is_active=eq.1`
      );
      if (user) {
        user.role_name = user.roles?.name;
        user.can_create_member = user.roles?.can_create_member;
        user.can_search_member = user.roles?.can_search_member;
        user.can_print_credentials = user.roles?.can_print_credentials;
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
      try {
        db.prepare('SELECT can_print_credentials FROM roles LIMIT 1').get();
      } catch {
        db.exec('ALTER TABLE roles ADD COLUMN can_print_credentials INTEGER DEFAULT 1');
      }

      user = db
        .prepare(
          'SELECT u.*, r.name as role_name, r.can_create_member, r.can_search_member, r.can_print_credentials, r.can_view_reports, r.can_view_birthdays, r.can_view_member_reports, r.can_view_complaints, r.can_view_pensioners, r.can_access_settings FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.is_active = 1'
        )
        .get(email);
      db.close();
    }

    // Constant-time mitigation against user enumeration
    if (!user) {
      // Execute dummy hash comparison to equalize response time
      await bcrypt.compare(password, '$2a$10$wN9P3XfA8U3e7lV5gQ6pLe8YyWdOqT0Z1bJ2k3m4n5o6p7q8r9s0t');
      loginRateLimiter.recordFailure(clientIp);
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      loginRateLimiter.recordFailure(clientIp);
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifica tu correo y contraseña.' },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful login
    loginRateLimiter.reset(clientIp);

    const jwtSecret = process.env.JWT_SECRET || 'sindicato-secret-key-2026';
    if (process.env.NODE_ENV === 'production' && jwtSecret === 'sindicato-secret-key-2026') {
      console.warn('SECURITY WARNING: Using default JWT_SECRET in production. Set JWT_SECRET in environment variables!');
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role_name,
      fullName: user.full_name,
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
      },
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
