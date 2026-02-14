-- Create event_shipments table for tracking shipments related to events
CREATE TABLE event_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'returned', 'issue')),
  ship_date TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  shipped_from TEXT,
  shipped_to TEXT,
  weight_lbs DECIMAL(10,2),
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_event_shipments_event_id ON event_shipments(event_id);
CREATE INDEX idx_event_shipments_status ON event_shipments(status);
CREATE INDEX idx_event_shipments_tracking_number ON event_shipments(tracking_number);
CREATE INDEX idx_event_shipments_deleted_at ON event_shipments(deleted_at);

-- Add RLS policy to bypass for service role
ALTER TABLE event_shipments ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to bypass RLS
CREATE POLICY "Service role can bypass RLS on event_shipments" ON event_shipments
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER event_shipments_updated_at
  BEFORE UPDATE ON event_shipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();