-- Progressive AAC renditions replace HLS.
-- A single fast-start .m4a per quality starts playing after the first few KB
-- (no manifest -> variant -> segment round-trips), is trivially signable as one
-- object, and is the same file the app downloads for offline playback.
ALTER TABLE "songs" DROP COLUMN "hls_manifest_key",
ADD COLUMN     "audio_low_key" TEXT,
ADD COLUMN     "audio_high_key" TEXT,
ADD COLUMN     "audio_low_bytes" INTEGER,
ADD COLUMN     "audio_high_bytes" INTEGER;

-- Indexes for the hot read paths (home feed, library, recommendations, trending).
CREATE INDEX "songs_artist_id_idx" ON "songs"("artist_id");
CREATE INDEX "songs_is_published_created_at_idx" ON "songs"("is_published", "created_at" DESC);
CREATE INDEX "songs_play_count_idx" ON "songs"("play_count" DESC);
CREATE INDEX "playlists_user_id_updated_at_idx" ON "playlists"("user_id", "updated_at" DESC);
CREATE INDEX "likes_user_id_created_at_idx" ON "likes"("user_id", "created_at" DESC);
CREATE INDEX "artist_follows_artist_id_idx" ON "artist_follows"("artist_id");
CREATE INDEX "listen_history_user_id_listened_at_idx" ON "listen_history"("user_id", "listened_at" DESC);
CREATE INDEX "listen_history_song_id_listened_at_idx" ON "listen_history"("song_id", "listened_at");
CREATE INDEX "listen_history_listened_at_idx" ON "listen_history"("listened_at");

-- Let songs match on their artist's name in full-text search.
CREATE OR REPLACE FUNCTION songs_search_vector_update() RETURNS trigger AS $$
DECLARE
  artist_name TEXT;
BEGIN
  SELECT stage_name INTO artist_name FROM artists WHERE id = NEW.artist_id;
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(artist_name, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.genres, ARRAY[]::text[]), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS songs_search_vector_tgr ON songs;
CREATE TRIGGER songs_search_vector_tgr
BEFORE INSERT OR UPDATE OF title, genres, tags, artist_id
ON songs
FOR EACH ROW EXECUTE FUNCTION songs_search_vector_update();

-- Re-index existing songs with the artist name included.
UPDATE songs SET title = title;
