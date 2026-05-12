import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');

export async function GET() {
  try {
    const db = new Database(dbPath);
    const designs = db.prepare('SELECT * FROM credential_designs ORDER BY is_active DESC, name').all();
    
    const designsWithElements = designs.map((d: any) => {
      const elements = db.prepare('SELECT * FROM visual_elements WHERE design_id = ? ORDER BY sort_order').all(d.id);
      return { ...d, elements };
    });
    
    db.close();
    return NextResponse.json(designsWithElements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    const id = `design-${crypto.randomUUID().substring(0, 8)}`;
    
    db.transaction(() => {
      db.prepare(`INSERT INTO credential_designs (id, name, section, background_url, primary_color, secondary_color, is_active, show_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, data.name, data.section || 'frente', data.background_url || null,
        data.primary_color || '#003366', data.secondary_color || '#EAB308',
        data.is_active ? 1 : 0, data.show_template !== false ? 1 : 0
      );
      
      if (data.elements && Array.isArray(data.elements)) {
        const insertEl = db.prepare(`INSERT INTO visual_elements (id, design_id, campo_bd, label, tipo, x, y, w, h, color, font_size, font_weight, alignment, is_visible, fixed_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        data.elements.forEach((el: any, i: number) => {
          insertEl.run(
            el.id || `ve-${crypto.randomUUID().substring(0, 8)}`,
            id, el.campo_bd, el.label, el.tipo || 'texto',
            el.x || 0, el.y || 0, el.w || 10, el.h || 3,
            el.color || '#000000', el.font_size || 8, el.font_weight || 'bold',
            el.alignment || 'left', el.is_visible !== false ? 1 : 0,
            el.fixed_text || null, i
          );
        });
      }
    })();
    
    db.close();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const db = new Database(dbPath);
    
    db.transaction(() => {
      // If setting active, deactivate others of same section
      if (data.is_active) {
        db.prepare('UPDATE credential_designs SET is_active = 0 WHERE section = ?').run(data.section || 'frente');
      }
      
      db.prepare(`UPDATE credential_designs SET name=?, section=?, background_url=?, primary_color=?, secondary_color=?, is_active=?, show_template=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
        data.name, data.section || 'frente', data.background_url || null,
        data.primary_color || '#003366', data.secondary_color || '#EAB308',
        data.is_active ? 1 : 0, data.show_template ? 1 : 0, data.id
      );
      
      // Refresh elements
      db.prepare('DELETE FROM visual_elements WHERE design_id = ?').run(data.id);
      if (data.elements && Array.isArray(data.elements)) {
        const insertEl = db.prepare(`INSERT INTO visual_elements (id, design_id, campo_bd, label, tipo, x, y, w, h, color, font_size, font_weight, alignment, is_visible, fixed_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        data.elements.forEach((el: any, i: number) => {
          insertEl.run(
            el.id || `ve-${crypto.randomUUID().substring(0, 8)}`,
            data.id, el.campo_bd, el.label, el.tipo || 'texto',
            el.x || 0, el.y || 0, el.w || 10, el.h || 3,
            el.color || '#000000', el.font_size || 8, el.font_weight || 'bold',
            el.alignment || 'left', el.is_visible !== false ? 1 : 0,
            el.fixed_text || null, i
          );
        });
      }
    })();
    
    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');
    
    const db = new Database(dbPath);
    db.prepare('DELETE FROM visual_elements WHERE design_id = ?').run(id);
    db.prepare('DELETE FROM credential_designs WHERE id = ?').run(id);
    db.close();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
