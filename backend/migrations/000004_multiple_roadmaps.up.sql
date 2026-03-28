-- Step 1: remove one-per-user constraint
ALTER TABLE roadmaps DROP CONSTRAINT roadmaps_one_per_user;

-- Step 2: add roadmap_id to topics
ALTER TABLE topics ADD COLUMN roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE;

-- Step 3: backfill existing topics with their user's single roadmap
UPDATE topics t
SET roadmap_id = (
    SELECT r.id FROM roadmaps r WHERE r.user_id = t.user_id LIMIT 1
)
WHERE roadmap_id IS NULL;

-- Step 4: make it required (after backfill all rows should have a value)
ALTER TABLE topics ALTER COLUMN roadmap_id SET NOT NULL;

CREATE INDEX idx_topics_roadmap_id ON topics (roadmap_id);
