import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isProduction, sSelect, sInsert, sUpdate, sDelete } from '@/lib/supabase';

export async function GET() {
  try {
    if (isProduction) {
      const designs = await sSelect('credential_designs', 'select=*,visual_elements(*)&order=is_active.desc,name');
      return NextResponse.json(designs.map((d: any) => ({ ...d, elements: d.visual_elements || [], visual_elements: undefined })));
    }
    const Database = (await import('better-sqlite3')).default;
    const path = await import('path');
    const db = new Database(path.join(process.cwd(), 'database.sqlite'));
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
    const id = `design-${crypto.randomUUID().substring(0, 8)}`;
    if (isProduction) {
      await sInsert('credential_designs', {
        id, name: data.name, section: data.section || 'frente', background_url: data.background_url || null,
        primary_color: data.primary_color || '#003366', secondary_color: data.secondary_color || '#EAB308',
        is_active: data.is_active ? 1 : 0, show_template: data.show_template !== false ? 1 : 0,
      });
      if (data.elements?.length) {
        const elements = data.elements.map((el: any, i: number) => ({
          id: el.id || `ve-${crypto.randomUUID().substring(0, 8)}`, design_id: id,
          campo_bd: el.campo_bd, label: el.label, tipo: el.tipo || 'texto',
          x: el.x || 0, y: el.y || 0, w: el.w || 10, h: el.h || 3,
          color: el.color || '#000000', font_size: el.font_size || 8, font_weight: el.font_weight || 'bold',
          alignment: el.alignment || 'left', is_visible: el.is_visible !== false ? 1 : 0,
          fixed_text: el.fixed_text || null, sort_order: i,
        }));
        await sInsert('visual_elements', elements);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.transaction(() => {
        db.prepare('INSERT INTO credential_designs (id, name, section, background_url, primary_color, secondary_color, is_active, show_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.name, data.section || 'frente', data.background_url || null, data.primary_color || '#003366', data.secondary_color || '#EAB308', data.is_active ? 1 : 0, data.show_template !== false ? 1 : 0);
        if (data.elements?.length) {
          const insertEl = db.prepare('INSERT INTO visual_elements (id, design_id, campo_bd, label, tipo, x, y, w, h, color, font_size, font_weight, alignment, is_visible, fixed_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          data.elements.forEach((el: any, i: number) => {
            insertEl.run(el.id || `ve-${crypto.randomUUID().substring(0, 8)}`, id, el.campo_bd, el.label, el.tipo || 'texto', el.x || 0, el.y || 0, el.w || 10, el.h || 3, el.color || '#000000', el.font_size || 8, el.font_weight || 'bold', el.alignment || 'left', el.is_visible !== false ? 1 : 0, el.fixed_text || null, i);
          });
        }
      })();
      db.close();
    }
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    if (isProduction) {
      if (data.is_active) {
        await sUpdate('credential_designs', `section=eq.${data.section || 'frente'}`, { is_active: 0 });
      }
      await sUpdate('credential_designs', `id=eq.${data.id}`, {
        name: data.name, section: data.section || 'frente', background_url: data.background_url || null,
        primary_color: data.primary_color || '#003366', secondary_color: data.secondary_color || '#EAB308',
        is_active: data.is_active ? 1 : 0, show_template: data.show_template ? 1 : 0,
      });
      await sDelete('visual_elements', `design_id=eq.${data.id}`);
      if (data.elements?.length) {
        const elements = data.elements.map((el: any, i: number) => ({
          id: el.id || `ve-${crypto.randomUUID().substring(0, 8)}`, design_id: data.id,
          campo_bd: el.campo_bd, label: el.label, tipo: el.tipo || 'texto',
          x: el.x || 0, y: el.y || 0, w: el.w || 10, h: el.h || 3,
          color: el.color || '#000000', font_size: el.font_size || 8, font_weight: el.font_weight || 'bold',
          alignment: el.alignment || 'left', is_visible: el.is_visible !== false ? 1 : 0,
          fixed_text: el.fixed_text || null, sort_order: i,
        }));
        await sInsert('visual_elements', elements);
      }
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.transaction(() => {
        if (data.is_active) db.prepare('UPDATE credential_designs SET is_active = 0 WHERE section = ?').run(data.section || 'frente');
        db.prepare('UPDATE credential_designs SET name=?, section=?, background_url=?, primary_color=?, secondary_color=?, is_active=?, show_template=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.name, data.section || 'frente', data.background_url || null, data.primary_color || '#003366', data.secondary_color || '#EAB308', data.is_active ? 1 : 0, data.show_template ? 1 : 0, data.id);
        db.prepare('DELETE FROM visual_elements WHERE design_id = ?').run(data.id);
        if (data.elements?.length) {
          const insertEl = db.prepare('INSERT INTO visual_elements (id, design_id, campo_bd, label, tipo, x, y, w, h, color, font_size, font_weight, alignment, is_visible, fixed_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          data.elements.forEach((el: any, i: number) => {
            insertEl.run(el.id || `ve-${crypto.randomUUID().substring(0, 8)}`, data.id, el.campo_bd, el.label, el.tipo || 'texto', el.x || 0, el.y || 0, el.w || 10, el.h || 3, el.color || '#000000', el.font_size || 8, el.font_weight || 'bold', el.alignment || 'left', el.is_visible !== false ? 1 : 0, el.fixed_text || null, i);
          });
        }
      })();
      db.close();
    }
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
    if (isProduction) {
      await sDelete('visual_elements', `design_id=eq.${id}`);
      await sDelete('credential_designs', `id=eq.${id}`);
    } else {
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const db = new Database(path.join(process.cwd(), 'database.sqlite'));
      db.prepare('DELETE FROM visual_elements WHERE design_id = ?').run(id);
      db.prepare('DELETE FROM credential_designs WHERE id = ?').run(id);
      db.close();
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
