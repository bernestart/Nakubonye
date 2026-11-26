-- 2026-11-26-discover-v2: swipes table + get_discover_profiles(me uuid, …)
-- Idempotent — safe to re-run. Run in Neon → SQL Editor.

CREATE TABLE IF NOT EXISTS swipes (
  swiper_id uuid NOT NULL,
  target_id uuid NOT NULL,
  action    text NOT NULL CHECK (action IN ('like','pass')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (swiper_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper_created ON swipes (swiper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes (target_id);

CREATE OR REPLACE FUNCTION get_discover_profiles(
  me uuid,
  p_limit int DEFAULT 20,
  p_same_city boolean DEFAULT false,
  p_shared_interests boolean DEFAULT false,
  p_same_country boolean DEFAULT false,
  p_verified_only boolean DEFAULT false,
  p_online_only boolean DEFAULT false,
  p_community_id bigint DEFAULT NULL
) RETURNS TABLE (
  id uuid, display_name text, username text, date_of_birth date,
  city text, country text, bio text, is_verified boolean,
  primary_photo text, last_seen_at timestamptz, is_boosted boolean
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.display_name::text,
    p.username::text,
    (to_jsonb(p) ->> 'date_of_birth')::date,
    (to_jsonb(p) ->> 'city')::text,
    (to_jsonb(p) ->> 'country')::text,
    (to_jsonb(p) ->> 'bio')::text,
    COALESCE(p.is_verified, false),
    (SELECT pp.storage_path FROM profile_photos pp
       WHERE pp.user_id = p.id
       ORDER BY pp.is_primary DESC, pp.display_order ASC LIMIT 1),
    p.last_seen_at,
    COALESCE((to_jsonb(p) ->> 'is_boosted')::boolean, false)
  FROM profiles p
  WHERE p.id <> me
    AND COALESCE(p.is_active, true) = true
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = me AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = me)
    )
    AND NOT EXISTS (
      SELECT 1 FROM swipes s WHERE s.swiper_id = me AND s.target_id = p.id
    )
    AND (NOT p_verified_only OR COALESCE(p.is_verified, false) = true)
    AND (NOT p_same_city OR
         (to_jsonb(p) ->> 'city') IS NOT DISTINCT FROM
         (SELECT (to_jsonb(pp2) ->> 'city') FROM profiles pp2 WHERE pp2.id = me))
    AND (NOT p_same_country OR
         (to_jsonb(p) ->> 'country') IS NOT DISTINCT FROM
         (SELECT (to_jsonb(pp2) ->> 'country') FROM profiles pp2 WHERE pp2.id = me))
  ORDER BY
    COALESCE((to_jsonb(p) ->> 'is_boosted')::boolean, false) DESC,
    p.last_seen_at DESC NULLS LAST,
    p.id
  LIMIT p_limit;
$$;
