-- Migrate historical breast feeding notes to structured side field
-- This updates events where users recorded "Left", "Right", or "Both" in notes

-- Update events where notes is exactly "Left" (case insensitive)
UPDATE events
SET meta = jsonb_set(
  jsonb_set(meta, '{yum,side}', '"left"'),
  '{notes}', '""'
)
WHERE event_type = 'YumYum'
  AND meta->'yum'->>'kind' = 'breast'
  AND (
    LOWER(TRIM(meta->>'notes')) = 'left'
    OR LOWER(TRIM(meta->'yum'->>'notes')) = 'left'
  );

-- Update events where notes is exactly "Right" (case insensitive)
UPDATE events
SET meta = jsonb_set(
  jsonb_set(meta, '{yum,side}', '"right"'),
  '{notes}', '""'
)
WHERE event_type = 'YumYum'
  AND meta->'yum'->>'kind' = 'breast'
  AND (
    LOWER(TRIM(meta->>'notes')) = 'right'
    OR LOWER(TRIM(meta->'yum'->>'notes')) = 'right'
  );

-- Update events where notes is exactly "Both" (case insensitive)
UPDATE events
SET meta = jsonb_set(
  jsonb_set(meta, '{yum,side}', '"both"'),
  '{notes}', '""'
)
WHERE event_type = 'YumYum'
  AND meta->'yum'->>'kind' = 'breast'
  AND (
    LOWER(TRIM(meta->>'notes')) = 'both'
    OR LOWER(TRIM(meta->'yum'->>'notes')) = 'both'
  );
