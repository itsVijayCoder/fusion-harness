ALTER TABLE models ADD COLUMN source TEXT CHECK (source IN ('live', 'fallback', 'suggested', 'custom'));
