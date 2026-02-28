-- Add attachments field to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';

-- Add AI metadata and chat session link to documents
ALTER TABLE documents
  ADD COLUMN ai_summary text,
  ADD COLUMN ai_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN chat_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Index for finding documents by chat session
CREATE INDEX idx_documents_chat_session ON documents (chat_session_id)
  WHERE chat_session_id IS NOT NULL;

-- Relax the XOR constraint: allow both null (unlinked/misc bucket)
-- and allow linking to both event and expense
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_link_xor'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_link_xor;
  END IF;
END
$$;
