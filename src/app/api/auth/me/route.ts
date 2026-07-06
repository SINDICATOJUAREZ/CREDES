import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        permissions: session.permissions || {},
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }
}
