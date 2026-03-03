import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const asset = url.searchParams.get('asset');
    const templateId = url.searchParams.get('template_id');
    if (!asset && !templateId) {
      return NextResponse.json({ error: 'asset or template_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (asset) {
      const needle = String(asset).trim();
      const { data: templates, error } = await supabase
        .from('card_templates')
        .select('*')
        .or(`asset.ilike.${needle},name.ilike.${needle}`)
        .limit(5);

      if (error || !templates || templates.length === 0) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const exact = templates.find(
        (t) => String(t.asset).toLowerCase() === needle.toLowerCase()
      );
      return NextResponse.json({ template: exact ?? templates[0] });
    }

    const { data: template, error } = await supabase
      .from('card_templates')
      .select('*')
      .eq('template_id', Number.parseInt(String(templateId), 10))
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
