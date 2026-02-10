-- ============================================
-- Phase 4: Document Storage Schema
-- ============================================

-- Document source: who uploaded it
CREATE TYPE document_source AS ENUM (
  'upload',         -- Manual upload via UI (Treynor)
  'api'             -- Uploaded via API (Scrooge agent)
);

-- ============================================
-- Core Documents Table
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File metadata
  filename TEXT NOT NULL,                  -- Display name (sanitized)
  original_filename TEXT NOT NULL,         -- User's original filename
  mime_type TEXT NOT NULL,                 -- application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,             -- Relative path on disk: uploads/2026/02/{uuid}.pdf

  -- Source tracking
  source document_source NOT NULL DEFAULT 'upload',

  -- Linking: exactly one of these must be set (XOR), or both null (unlinked)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,

  -- Timestamps & soft delete
  uploaded_by TEXT NOT NULL DEFAULT 'user', -- 'user' or 'scrooge'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- At most one parent: cannot be linked to BOTH an event and an expense
  CONSTRAINT document_max_one_parent CHECK (
    NOT (event_id IS NOT NULL AND expense_id IS NOT NULL)
  )
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_documents_event ON documents(event_id) WHERE event_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_expense ON documents(expense_id) WHERE expense_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_created ON documents(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_unlinked ON documents(id)
  WHERE event_id IS NULL AND expense_id IS NULL AND deleted_at IS NULL;

-- ============================================
-- Updated_at trigger (reuse existing pattern)
-- ============================================
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
