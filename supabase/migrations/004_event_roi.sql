-- ============================================
-- Migration 004: Event ROI Tracking
-- ============================================
-- Adds ROI (Return on Investment) fields to events table
-- for tracking pipeline, revenue, leads, meetings, and opportunities.

ALTER TABLE events
  ADD COLUMN pipeline_generated DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN revenue_closed DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN leads_generated INTEGER DEFAULT 0,
  ADD COLUMN meetings_booked INTEGER DEFAULT 0,
  ADD COLUMN opportunities_created INTEGER DEFAULT 0,
  ADD COLUMN roi_notes TEXT;
