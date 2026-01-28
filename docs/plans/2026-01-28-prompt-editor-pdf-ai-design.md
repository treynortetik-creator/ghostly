# Prompt Editor + AI PDF Processing Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add editable AI prompts to Settings and upgrade PDF import to use LLM for extraction + assignment suggestions.

**Architecture:** Two custom prompts stored in `app_settings` Supabase table. Settings page gets a new "AI Prompts" section with textarea editors. PDF import route sends extracted text to OpenRouter for intelligent parsing and assignment suggestion. Both prompts fall back to hardcoded defaults when no custom version exists.

**Tech Stack:** Next.js App Router, Supabase, OpenRouter API, pdf-parse, TypeScript

---

## Data Model

Two new rows in existing `app_settings` table:

| key | value (JSON) |
|-----|------|
| `prompt_csv_categorization` | `{ "prompt": "..." }` |
| `prompt_pdf_extraction` | `{ "prompt": "..." }` |

No schema changes needed - `app_settings.value` is already `Json` type.

When row doesn't exist → use hardcoded default from `openrouter.ts`.
"Reset to Default" → deletes the row.

---

## Task 1: Add prompt fetching to openrouter.ts

**File:** `src/lib/openrouter.ts`

- Add `getCustomPrompt(key: string, supabase): Promise<string | null>` that queries `app_settings` by key
- Add `DEFAULT_CSV_PROMPT` and `DEFAULT_PDF_PROMPT` constants (extract current hardcoded prompt into constant)
- Modify `buildCategorizationSystemPrompt()` to accept optional custom prompt base text
- Add new `buildPdfExtractionPrompt(targets, customPrompt?)` function

---

## Task 2: Settings API - prompt endpoints

**File:** `src/app/api/settings/route.ts`

- GET: Also return `prompts: { csv_categorization: string | null, pdf_extraction: string | null }`
- PUT: Accept `prompts.csv_categorization` and `prompts.pdf_extraction` in body, upsert to `app_settings`
- Add DELETE support for individual prompt keys (reset to default)

---

## Task 3: Prompt Editor component

**File:** `src/components/settings/PromptEditor.tsx`

- Textarea with label, description, character count
- "Reset to Default" button (shows confirmation)
- Shows whether using custom or default prompt
- Victorian theme consistent with other settings components

---

## Task 4: Settings page - add prompt editors

**File:** `src/app/settings/page.tsx`

- Add two PromptEditor instances below the model selector
- Wire up to settings state and save flow
- Labels: "CSV Categorization Prompt", "PDF Extraction Prompt"

---

## Task 5: Upgrade PDF import route to use AI

**File:** `src/app/api/import/pdf/route.ts`

- Keep pdf-parse for text extraction (still needed to get raw text from PDF)
- After text extraction, send to OpenRouter with the PDF extraction prompt
- LLM extracts: vendor, amount, date (replacing regex)
- LLM also suggests: event/category assignment with confidence
- Need events + categories from Supabase for the assignment suggestion context
- Return same response shape but with AI-powered extraction + assignment suggestion
- Fallback to current regex if no API key or AI call fails

---

## Task 6: Update PDF import frontend

**File:** `src/app/import/pdf/page.tsx`

- Show AI-suggested assignment in the AssignmentSelector (pre-selected with confidence badge)
- Show AI confidence for extracted fields alongside the existing confidence badges

---

## Default Prompts

### CSV Categorization (existing, extracted to constant):
The current `buildCategorizationSystemPrompt()` content becomes `DEFAULT_CSV_PROMPT`.

### PDF Extraction (new):
```
You are an invoice data extraction and categorization assistant for "The Counting House", a corporate events budget tracking system.

Given the raw text extracted from a PDF invoice, extract the following fields and suggest an event/category assignment:

EXTRACT THESE FIELDS:
1. vendor: The company or person who issued the invoice
2. amount: The total amount due (in USD)
3. date: The invoice date (format: YYYY-MM-DD)

AVAILABLE EVENTS:
{events_list}

AVAILABLE BUDGET CATEGORIES:
{categories_list}

ASSIGNMENT GUIDELINES:
- Match based on vendor name, invoice description, and any event/conference references
- Use budget categories for general expenses not tied to a specific event
- Provide confidence score 0.0-1.0

RESPONSE FORMAT (JSON only, no markdown):
{
  "vendor": "string",
  "amount": number,
  "date": "YYYY-MM-DD",
  "confidence": {
    "vendor": "high|medium|low",
    "amount": "high|medium|low",
    "date": "high|medium|low"
  },
  "suggestedAssignment": {
    "id": "string or null",
    "type": "event|category|null",
    "name": "string or null",
    "confidence": number
  },
  "reasoning": "brief explanation"
}
```
