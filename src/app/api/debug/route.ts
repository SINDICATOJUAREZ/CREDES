import { NextResponse } from 'next/server';
import { getDbStatus } from '@/lib/supabase';

export async function GET() {
  return NextResponse.json(getDbStatus());
}
