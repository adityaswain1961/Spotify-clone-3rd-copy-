-- Full-text search support for songs, artists, playlists

-- SONGS
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS songs_search_vector_gin
  ON songs
  USING gin(search_vector);

CREATE OR REPLACE FUNCTION songs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.genres, ARRAY[]::text[]), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS songs_search_vector_tgr ON songs;
CREATE TRIGGER songs_search_vector_tgr
BEFORE INSERT OR UPDATE OF title, genres, tags
ON songs
FOR EACH ROW EXECUTE FUNCTION songs_search_vector_update();

-- ARTISTS
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS artists_search_vector_gin
  ON artists
  USING gin(search_vector);

CREATE OR REPLACE FUNCTION artists_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.stage_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS artists_search_vector_tgr ON artists;
CREATE TRIGGER artists_search_vector_tgr
BEFORE INSERT OR UPDATE OF stage_name, bio
ON artists
FOR EACH ROW EXECUTE FUNCTION artists_search_vector_update();

-- PLAYLISTS (public only via query filter; vector exists regardless)
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS playlists_search_vector_gin
  ON playlists
  USING gin(search_vector);

CREATE OR REPLACE FUNCTION playlists_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playlists_search_vector_tgr ON playlists;
CREATE TRIGGER playlists_search_vector_tgr
BEFORE INSERT OR UPDATE OF title, description
ON playlists
FOR EACH ROW EXECUTE FUNCTION playlists_search_vector_update();

-- Backfill
UPDATE songs SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', array_to_string(coalesce(genres, ARRAY[]::text[]), ' ')), 'B') ||
  setweight(to_tsvector('english', array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')), 'C')
WHERE search_vector IS NULL;

UPDATE artists SET search_vector =
  setweight(to_tsvector('english', coalesce(stage_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(bio, '')), 'B')
WHERE search_vector IS NULL;

UPDATE playlists SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
WHERE search_vector IS NULL;

