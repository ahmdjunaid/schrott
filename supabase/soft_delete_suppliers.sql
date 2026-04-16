-- Add is_active column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing suppliers to be active
UPDATE suppliers SET is_active = true WHERE is_active IS NULL;

-- Add index for performance on filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active) WHERE is_active = true;
