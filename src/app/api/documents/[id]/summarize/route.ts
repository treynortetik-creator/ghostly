/**
 * Document Summarization API
 *
 * POST /api/documents/:id/summarize
 * Uses AI to generate a summary and keyword tags for a document.
 * Returns cached results if already summarized.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { extractTextFromFile } from '@/lib/agent/file-processor';
import { OPENROUTER_API_URL, DEFAULT_AGENT_MODEL } from '@/lib/ai';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    // Fetch document scoped to org, not soft-deleted
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, filename, mime_type, storage_path, ai_summary, ai_tags')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // If already summarized, return cached result
    if (doc.ai_summary) {
      return NextResponse.json({
        summary: doc.ai_summary,
        tags: doc.ai_tags ?? [],
      });
    }

    // Extract text content from the file
    let text: string;
    try {
      text = await extractTextFromFile(doc.storage_path, doc.mime_type);
    } catch {
      return NextResponse.json(
        { error: 'Could not extract text from document' },
        { status: 422 }
      );
    }

    if (!text || text.startsWith('[')) {
      return NextResponse.json(
        { error: 'Document type does not support text extraction' },
        { status: 422 }
      );
    }

    // Call OpenRouter to generate summary + tags
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
        'X-Title': 'Ghostly Agent',
      },
      body: JSON.stringify({
        model: DEFAULT_AGENT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a document analyzer for an event management platform. Given a document\'s text content, produce: 1. A 2-3 sentence summary. 2. 3-5 keyword tags. Respond in JSON: {"summary": "...", "tags": ["..."]}',
          },
          {
            role: 'user',
            content: `Filename: ${doc.filename}\n\nDocument content:\n${text.slice(0, 10000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!orResponse.ok) {
      const errorText = await orResponse.text();
      console.error('OpenRouter summarization error:', orResponse.status, errorText);
      return NextResponse.json(
        { error: 'AI summarization request failed' },
        { status: 502 }
      );
    }

    const orData = await orResponse.json();
    const rawContent = orData.choices?.[0]?.message?.content || '';

    // Parse JSON from the response (handle markdown code fences)
    let summary = '';
    let tags: string[] = [];

    try {
      const jsonStr = rawContent.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      summary = parsed.summary || '';
      tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    } catch {
      // Fallback: use raw content as summary if JSON parsing fails
      summary = rawContent.trim();
      tags = [];
    }

    // Save to document record
    const { error: updateError } = await supabase
      .from('documents')
      .update({ ai_summary: summary, ai_tags: tags })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (updateError) {
      console.error('Failed to save document summary:', updateError);
    }

    return NextResponse.json({ summary, tags });
  }
);
