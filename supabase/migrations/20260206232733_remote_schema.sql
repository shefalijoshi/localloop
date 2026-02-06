


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."approval_mode" AS ENUM (
    'must_approve',
    'notify_after',
    'independent'
);


ALTER TYPE "public"."approval_mode" OWNER TO "postgres";


CREATE TYPE "public"."assist_status" AS ENUM (
    'confirmed',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."assist_status" OWNER TO "postgres";


CREATE TYPE "public"."dog_size" AS ENUM (
    'small',
    'medium',
    'large',
    'extra_large'
);


ALTER TYPE "public"."dog_size" OWNER TO "postgres";


CREATE TYPE "public"."membership_status" AS ENUM (
    'pending_location',
    'pending_second_vouch',
    'active',
    'inactive',
    'request_pending'
);


ALTER TYPE "public"."membership_status" OWNER TO "postgres";


CREATE TYPE "public"."offer_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled'
);


ALTER TYPE "public"."offer_status" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'active',
    'filled',
    'expired',
    'cancelled',
    'archived'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'seeker',
    'helper',
    'caregiver',
    'dependent'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."walker_preference" AS ENUM (
    'no_preference',
    'prefers_male',
    'prefers_female'
);


ALTER TYPE "public"."walker_preference" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_neighborhood_offer"("target_offer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_request_id UUID;
  v_helper_id UUID;
  v_seeker_id UUID;
  v_request_duration NUMERIC;
  v_request_status public.request_status;
  v_share_phone BOOLEAN;
  v_share_email BOOLEAN;
BEGIN
  -- 1. Get the details and lock the rows to prevent race conditions
  SELECT request_id, helper_id, share_phone, share_email INTO v_request_id, v_helper_id, v_share_phone, v_share_email
  FROM public.offers
  WHERE id = target_offer_id
  FOR UPDATE;

  SELECT status, seeker_id, duration INTO v_request_status, v_seeker_id, v_request_duration
  FROM public.requests
  WHERE id = v_request_id
  FOR UPDATE;

  -- 2. GATEKEEPER: Prevent accepting if the request is no longer active
  IF v_request_status != 'active' THEN
    RAISE EXCEPTION 'This request is no longer active and cannot accept new offers.';
  END IF;

  -- 3. THE ATOMIC STEPS:
  
  -- A. Accept the target offer
  UPDATE public.offers 
  SET status = 'accepted' 
  WHERE id = target_offer_id;

  -- B. Decline all other pending offers for this request
  UPDATE public.offers 
  SET status = 'declined'
  WHERE request_id = v_request_id 
  AND id != target_offer_id 
  AND status = 'pending';

  -- C. Mark the Request as filled
  UPDATE public.requests 
  SET status = 'filled' 
  WHERE id = v_request_id;

  -- D. Create the Assist record
  INSERT INTO public.assists (request_id, helper_id, seeker_id, status, helper_shared_phone, helper_shared_email, expected_duration)
  VALUES (v_request_id, v_helper_id, v_seeker_id, 'confirmed', v_share_phone, v_share_email, v_request_duration);

END;$$;


ALTER FUNCTION "public"."accept_neighborhood_offer"("target_offer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_join_request"("p_membership_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_seed_profile_id uuid;
  v_neighborhood_id uuid;
BEGIN
  SELECT id INTO v_seed_profile_id FROM public.profiles WHERE user_id = auth.uid();

  SELECT m.neighborhood_id INTO v_neighborhood_id
  FROM public.neighborhood_memberships m
  JOIN public.seed_users s ON m.neighborhood_id = s.neighborhood_id
  WHERE m.id = p_membership_id AND s.profile_id = v_seed_profile_id;

  IF v_neighborhood_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHORIZED_SEED');
  END IF;

  UPDATE public.neighborhood_memberships
  SET 
    primary_vouch_by = v_seed_profile_id,
    status = 'pending_second_vouch',
    invited_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.system_events (event_type, neighborhood_id, metadata)
  VALUES ('seed_vouch_completed', v_neighborhood_id, jsonb_build_object('membership_id', p_membership_id));

  RETURN json_build_object('success', true, 'new_status', 'pending_second_vouch');
END;$$;


ALTER FUNCTION "public"."approve_join_request"("p_membership_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_distance"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  r DECIMAL := 3959; -- Earth radius in miles
  dlat DECIMAL;
  dlng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  
  a := SIN(dlat/2) * SIN(dlat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlng/2) * SIN(dlng/2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN r * c;
END;
$$;


ALTER FUNCTION "public"."calculate_distance"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_assist"("p_assist_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_request_id UUID;
BEGIN
  SELECT request_id INTO v_request_id 
  FROM public.assists 
  WHERE id = p_assist_id;

  UPDATE public.assists
  SET 
    status = 'completed'::assist_status,
    completed_at = NOW()
  WHERE id = p_assist_id 
  AND status = 'in_progress'
  AND helper_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid());

  UPDATE public.requests
  SET status = 'archived' 
  WHERE id = v_request_id;
END;
$$;


ALTER FUNCTION "public"."complete_assist"("p_assist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_neighborhood_request"("p_category_id" "text", "p_action_id" "text", "p_request_type" "text", "p_subject_tag" "text", "p_details" "text", "p_duration" integer, "p_scheduled_time" timestamp with time zone DEFAULT "now"(), "p_help_detail_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_seeker_id UUID;
  v_neighborhood_id UUID;
  v_full_address TEXT;
  v_street_name TEXT;
  v_expires_at TIMESTAMPTZ;
  v_snapshot_data JSONB := '{}'::jsonb;
  v_request_id UUID;
BEGIN
  -- 1. Get Seeker Context
  SELECT id, neighborhood_id, address 
  INTO v_seeker_id, v_neighborhood_id, v_full_address
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- 2. Extract Street Name (Privacy first)
  SELECT REGEXP_REPLACE(v_full_address, '^[0-9]+ ', '') INTO v_street_name;

  -- 3. THE AUDIT STEP: If this is a Pet request, freeze the traits in a snapshot
  IF p_help_detail_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'name', name,
      'size', dog_size,
      'temperament', temperament,
      'special_needs', special_needs
    ) INTO v_snapshot_data
    FROM public.help_details
    WHERE id = p_help_detail_id AND seeker_id = v_seeker_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pet profile not found or access denied';
    END IF;
  END IF;

  -- 4. Set Expiry Logic
  -- Services usually expire 1 hour before start time.
  -- Items (borrowing) stay active for 24 hours to give neighbors time to see it.
  IF p_request_type = 'item' THEN
    v_expires_at := p_scheduled_time + interval '24 hours';
  ELSE
    IF p_scheduled_time <= now() + interval '5 minutes' THEN
        v_expires_at := now() + interval '30 minutes';
    ELSE
        v_expires_at := p_scheduled_time - interval '1 hour';
    END IF;
  END IF;

  -- 5. Insert the Generalized Request
  INSERT INTO public.requests (
    seeker_id,
    neighborhood_id,
    category_id,
    action_id,
    request_type,
    subject_tag,
    details,
    duration,
    timeframe,
    expires_at,
    street_name,
    full_address,
    help_detail_id, -- Keep the link for active logic
    snapshot_data,  -- The immutable audit trail
    status
  )
  VALUES (
    v_seeker_id,
    v_neighborhood_id,
    p_category_id,
    p_action_id,
    p_request_type,
    p_subject_tag,
    p_details,
    p_duration,
    p_scheduled_time,
    v_expires_at,
    v_street_name,
    v_full_address,
    p_help_detail_id,
    v_snapshot_data,
    'active'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;$$;


ALTER FUNCTION "public"."create_neighborhood_request"("p_category_id" "text", "p_action_id" "text", "p_request_type" "text", "p_subject_tag" "text", "p_details" "text", "p_duration" integer, "p_scheduled_time" timestamp with time zone, "p_help_detail_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_walker_preference" "public"."walker_preference" DEFAULT 'no_preference'::"public"."walker_preference") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_seeker_id UUID;
  v_neighborhood_id UUID;
  v_full_address TEXT;
  v_street_name TEXT;
  v_dog_size public.dog_size;
  v_dog_name TEXT;
  v_temperament TEXT[];
  v_special_needs TEXT;
  v_expires_at TIMESTAMPTZ;
  v_request_id UUID;
BEGIN
  SELECT id, neighborhood_id, address 
  INTO v_seeker_id, v_neighborhood_id, v_full_address
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Get traits from the specific card
  SELECT dog_size, temperament, special_needs, name
  INTO v_dog_size, v_temperament, v_special_needs, v_dog_name
  FROM public.help_details
  WHERE id = p_help_detail_id AND seeker_id = v_seeker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Help details not found or access denied';
  END IF;

  SELECT REGEXP_REPLACE(v_full_address, '^[0-9]+ ', '')
  INTO v_street_name;

  IF p_timeframe_type = 'now' THEN
    v_expires_at := now() + interval '30 minutes';
  ELSE
    v_expires_at := p_scheduled_time - interval '1 hour';
  END IF;

  INSERT INTO public.requests (
    seeker_id,
    neighborhood_id,
    help_detail_id, -- Added this link
    dog_size,
    dog_name,
    temperament,
    special_needs,
    duration,
    walker_preference,
    timeframe,
    expires_at,
    street_name,
    full_address,
    status
  )
  VALUES (
    v_seeker_id,
    v_neighborhood_id,
    p_help_detail_id, -- Store the ID
    v_dog_size,
    v_dog_name,
    v_temperament,
    v_special_needs,
    p_duration,
    p_walker_preference,
    COALESCE(p_scheduled_time, now()),
    v_expires_at,
    v_street_name,
    v_full_address,
    'active'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;$$;


ALTER FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone, "p_walker_preference" "public"."walker_preference") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone, "p_walker_preference" "public"."walker_preference") IS 'DEPRECATED: Use create_neighborhood_request instead. Target removal date: 2026-01-09.';



CREATE OR REPLACE FUNCTION "public"."find_and_request_join"("user_lat" numeric, "user_lng" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_neighborhood jsonb;
  v_current_profile_id uuid;
  v_profile_location_verified boolean;
  v_membership_id uuid;
  v_current_status public.membership_status;
  v_auth_user_id uuid := auth.uid();
  new_code text;
  vouch_expiration TIMESTAMPTZ;
BEGIN
  SELECT id, location_verified INTO v_current_profile_id, v_profile_location_verified FROM public.profiles WHERE user_id = v_auth_user_id;
  
  IF v_current_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  SELECT public.find_nearest_neighborhood(user_lat, user_lng)
  INTO v_neighborhood;

  IF (v_neighborhood->>'id')::uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NO_NEIGHBORHOOD_FOUND');
  END IF;

  SELECT id, status INTO v_membership_id, v_current_status
  FROM public.neighborhood_memberships
  WHERE profile_id = v_current_profile_id;

  IF v_membership_id IS NOT NULL THEN
    IF v_current_status = 'active' THEN
      RETURN json_build_object('success', false, 'error', 'MEMBER');
    ELSIF v_current_status = 'request_pending' THEN
      RETURN json_build_object('success', false, 'error', 'PENDING_REQUEST');
    ELSIF EXISTS (
      SELECT 1 FROM public.neighborhood_memberships 
      WHERE id = v_membership_id AND primary_vouch_by IS NOT NULL
    ) THEN
      RETURN json_build_object('success', false, 'error', 'PENDING_VOUCH');
    END IF;
  
  END IF;

  new_code := public.generate_verification_code();
  vouch_expiration := now() + interval '48 hours';

  IF v_membership_id IS NULL THEN
    INSERT INTO public.neighborhood_memberships (
      neighborhood_id, 
      profile_id, 
      user_id, 
      status, 
      invited_at,
      vouch_verification_code,
      vouch_code_expires_at
    )
    VALUES (
      (v_neighborhood->>'id')::uuid, 
      v_current_profile_id, 
      v_auth_user_id, 
      'request_pending', 
      now(),
      new_code,
      vouch_expiration
    )
    RETURNING id INTO v_membership_id;
  ELSE
    UPDATE public.neighborhood_memberships
    SET 
      neighborhood_id = (v_neighborhood->>'id')::uuid,
      status = 'request_pending',
      invited_at = now(),
      vouch_verification_code = new_code,
      vouch_code_expires_at = vouch_expiration
    WHERE id = v_membership_id;
  END IF;

  INSERT INTO public.system_events (
    event_type, 
    neighborhood_id, 
    profile_id, 
    user_id, 
    metadata
  )
  VALUES (
    'join_request_initiated', 
    (v_neighborhood->>'id')::uuid, 
    v_current_profile_id, 
    v_auth_user_id, 
    jsonb_build_object(
      'membership_id', v_membership_id, 
      'lat', user_lat, 
      'lng', user_lng,
      'neighborhood_name', (v_neighborhood->>'name')::text,
      'location_verified', v_profile_location_verified,
      'vouch_verification_code', new_code,
      'vouch_code_expires_at', vouch_expiration
    )
  );

  RETURN json_build_object(
    'success', true, 
    'neighborhood_id', (v_neighborhood->>'id')::uuid, 
    'neighborhood_name', (v_neighborhood->>'name')::text
  );
END;$$;


ALTER FUNCTION "public"."find_and_request_join"("user_lat" numeric, "user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_nearest_neighborhood"("user_lat" numeric, "user_lng" numeric, "max_radius_miles" numeric DEFAULT 0.5) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_neighborhood jsonb;
BEGIN
  SELECT to_jsonb(n)
  INTO v_neighborhood
  FROM public.neighborhoods n
  WHERE calculate_distance(user_lat, user_lng, n.center_lat, n.center_lng) <= max_radius_miles
  ORDER BY calculate_distance(user_lat, user_lng, n.center_lat, n.center_lng)
  LIMIT 1;

  RETURN v_neighborhood;
END;
$$;


ALTER FUNCTION "public"."find_nearest_neighborhood"("user_lat" numeric, "user_lng" numeric, "max_radius_miles" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- exclude similar chars
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_verification_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_verification_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assist_details"("t_assist_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Get the current user's profile ID
  SELECT id INTO v_profile_id 
  FROM public.profiles 
  WHERE user_id = v_user_id;

  -- Select from our shared view with a security check
  SELECT row_to_json(v) INTO v_result
  FROM public.view_assist_details v
  WHERE v.id = t_assist_id
  AND (v.seeker_id = v_profile_id OR v.helper_id = v_profile_id);

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Assist not found or access denied';
  END IF;

  RETURN v_result;
END;$$;


ALTER FUNCTION "public"."get_assist_details"("t_assist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from profiles where user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighborhood_feed"("filter_categories" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_user_id UUID := auth.uid();
  v_neighborhood_id UUID;
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Get the current user's profile info
  SELECT id, neighborhood_id INTO v_profile_id, v_neighborhood_id 
  FROM public.profiles WHERE user_id = v_user_id;

  SELECT jsonb_build_object(
    'my_requests', (
      SELECT coalesce(jsonb_agg(r), '[]'::jsonb)
      FROM (
        SELECT 
          r.id, 
          r.duration, 
          r.timeframe as scheduled_time,
          r.expires_at,
          r.created_at, 
          r.street_name,
          r.category_id,
          r.action_id,
          r.request_type,
          r.details,
          r.subject_tag,
          r.snapshot_data ->> 'name' as display_name,
          (SELECT count(*)::int FROM public.offers o WHERE o.request_id = r.id AND o.status = 'pending') as offer_count
        FROM public.requests r
        WHERE r.seeker_id = v_profile_id
        AND r.status = 'active'
        AND r.expires_at > now()
        AND (filter_categories IS NULL OR r.category_id = ANY(filter_categories))
        ORDER BY r.created_at DESC
      ) r
    ),
    'neighborhood_requests', (
      SELECT coalesce(jsonb_agg(neigh), '[]'::jsonb)
      FROM (
        SELECT 
          r.id, 
          r.duration, 
          r.timeframe as scheduled_time,
          r.expires_at, 
          r.created_at,
          r.street_name,
          r.category_id,
          r.action_id,
          r.request_type,
          r.details,
          r.subject_tag,
          r.snapshot_data ->> 'name' as display_name,
          (SELECT helper_id FROM public.offers o WHERE o.request_id = r.id AND o.status = 'pending' AND o.helper_id = v_profile_id) as helper_id
        FROM public.requests r
        WHERE r.neighborhood_id = v_neighborhood_id
        AND r.seeker_id != v_profile_id
        AND r.status = 'active'
        AND r.expires_at > now()
        AND (filter_categories IS NULL OR r.category_id = ANY(filter_categories))
        ORDER BY r.timeframe ASC, r.created_at DESC
      ) neigh
    ),
    'active_assists', (
      SELECT coalesce(jsonb_agg(a), '[]'::jsonb)
      FROM (
        SELECT * FROM public.view_assist_details v
        WHERE (v.seeker_id = v_profile_id OR v.helper_id = v_profile_id)
        AND v.status IN ('confirmed', 'in_progress', 'completed')
        AND (filter_categories IS NULL OR v.category_id = ANY(filter_categories))
        ORDER BY v.created_at DESC
      ) a
    )
  ) INTO v_result;

  RETURN v_result;
END;$$;


ALTER FUNCTION "public"."get_neighborhood_feed"("filter_categories" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_join_requests"() RETURNS TABLE("membership_id" "uuid", "profile_id" "uuid", "display_name" "text", "street_name" "text", "location_verified" boolean, "vouch_verification_code" "text", "created_at" timestamp with time zone, "vouch_code_expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    m.id AS membership_id,
    p.id AS profile_id,
    p.display_name,
    -- Strip house number for privacy (e.g., "123 Main St" -> "Main St")
    regexp_replace(p.address, '^[0-9]+ ', '') AS street_name,
    p.location_verified,
    m.vouch_verification_code,
    m.invited_at AS created_at, -- Mapping for your "NEW" badge logic
    m.vouch_code_expires_at
  FROM public.neighborhood_memberships m
  JOIN public.profiles p ON m.profile_id = p.id
  JOIN public.seed_users s ON m.neighborhood_id = s.neighborhood_id
  JOIN public.profiles seed_p ON s.profile_id = seed_p.id
  WHERE seed_p.user_id = auth.uid()
    AND m.status = 'request_pending'
    AND m.primary_vouch_by IS NULL
    AND m.vouch_code_expires_at > now()
  ORDER BY m.vouch_code_expires_at ASC;
$$;


ALTER FUNCTION "public"."get_pending_join_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_details"("target_id" "uuid") RETURNS TABLE("display_name" "text", "email" "text", "phone" "text", "address" "text", "role" "public"."user_role")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.display_name,
    u.email::TEXT,
    p.phone,
    p.address,
    p.role
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE p.id = target_id;
END;
$$;


ALTER FUNCTION "public"."get_profile_details"("target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email_by_profile"("target_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT u.email INTO user_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.user_id
  WHERE p.id = target_id 
  AND p.user_id = auth.uid(); -- Security check

  RETURN user_email;
END;
$$;


ALTER FUNCTION "public"."get_user_email_by_profile"("target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
  INSERT INTO public.profiles (user_id, role, display_name)
  VALUES (
    new.id,
    'seeker'::public.user_role,
    split_part(new.email, '@', 1)
  );
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_neighborhood"("neighborhood_name" "text", "user_lat" numeric, "user_lng" numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  new_neighborhood_id uuid;
  current_profile_id uuid;
  existing_neighborhood_name TEXT;
BEGIN
  -- 1. Identify the profile of the caller
  SELECT id INTO current_profile_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF current_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found. Please complete signup first.';
  END IF;

  -- 2. COLLISION GUARD: Is there already a neighborhood within 0.5 miles?
  SELECT result->>'name'
  INTO existing_neighborhood_name
  FROM public.find_nearest_neighborhood(user_lat, user_lng) AS result;

  IF existing_neighborhood_name IS NOT NULL THEN
    RAISE EXCEPTION 'COLLISION: % is already established here.', existing_neighborhood_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM neighborhood_memberships 
    WHERE profile_id = current_profile_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are already an active member of a neighborhood.';
  END IF;

  -- 4. Create the Neighborhood
  INSERT INTO neighborhoods (
    name, 
    center_lat, 
    center_lng, 
    radius_miles, 
    created_by
  )
  VALUES (
    neighborhood_name, 
    user_lat, 
    user_lng, 
    0.5, 
    current_profile_id
  )
  RETURNING id INTO new_neighborhood_id;

  INSERT INTO neighborhood_memberships (
    neighborhood_id, 
    profile_id, 
    user_id,
    status, 
    joined_at
  )
  VALUES (
    new_neighborhood_id, 
    current_profile_id, 
    auth.uid(),
    'active'::membership_status,
    now()
  );

  -- 6. Promote to Seed User
  INSERT INTO seed_users (
    neighborhood_id, 
    profile_id
  )
  VALUES (
    new_neighborhood_id, 
    current_profile_id
  );

  RETURN new_neighborhood_id;
END;$$;


ALTER FUNCTION "public"."initialize_neighborhood"("neighborhood_name" "text", "user_lat" numeric, "user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_neighborhood"("invite_code_text" "text", "user_lat" numeric, "user_lng" numeric, "locationverified" boolean) RETURNS "public"."membership_status"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  target_invite RECORD;
  n_record RECORD;
  dist DECIMAL;
  final_status membership_status;
  current_profile_id uuid;
BEGIN
   -- 0. Identify the profile of the caller
  SELECT id INTO current_profile_id FROM public.profiles WHERE user_id = auth.uid();

  IF current_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
  -- 1. Check if code exists and is valid
  SELECT * INTO target_invite FROM invite_codes 
  WHERE code = invite_code_text AND used_at IS NULL AND expires_at > now()
  FOR UPDATE; -- Prevents two people from using same code at same millisecond

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code.';
  END IF;

  -- 2. Verify Distance
  IF locationVerified THEN
  final_status := 'active'::membership_status;
  ELSE
  SELECT * INTO n_record FROM neighborhoods WHERE id = target_invite.neighborhood_id;
  dist := calculate_distance(user_lat, user_lng, n_record.center_lat, n_record.center_lng);

  final_status := CASE WHEN dist <= 0.5 THEN 'active'::membership_status 
                  ELSE 'pending_second_vouch'::membership_status END;
  END IF;

  -- 3. Create Membership (Revised for safety)
INSERT INTO neighborhood_memberships (neighborhood_id, profile_id, user_id, status, primary_vouch_by, joined_at)
VALUES (
  target_invite.neighborhood_id, 
  current_profile_id, 
  auth.uid(),      -- <--- ADDED THIS
  final_status,
  target_invite.created_by,
  now()
);

  UPDATE invite_codes SET used_at = now(), used_by = current_profile_id WHERE id = target_invite.id;
  
  RETURN final_status; 
END;$$;


ALTER FUNCTION "public"."join_neighborhood"("invite_code_text" "text", "user_lat" numeric, "user_lng" numeric, "locationverified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_vouch_handshake"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_code text;
BEGIN
  -- Call your existing utility function
  new_code := public.generate_verification_code();

  -- Save it to the membership record
  UPDATE public.neighborhood_memberships
  SET vouch_verification_code = new_code,
      vouch_code_expires_at = now() + interval '15 minutes'
  WHERE user_id = auth.uid() 
    AND status = 'pending_second_vouch';

  RETURN new_code;
END;
$$;


ALTER FUNCTION "public"."request_vouch_handshake"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_assist_verification_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.verification_code IS NULL THEN
    NEW.verification_code := generate_verification_code();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_assist_verification_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stamp_report_neighborhood"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- We look up the neighborhood via the assist -> request chain
  SELECT r.neighborhood_id INTO NEW.neighborhood_id
  FROM assists a
  JOIN requests r ON a.request_id = r.id
  WHERE a.id = NEW.assist_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."stamp_report_neighborhood"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_assist"("p_assist_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.assists
  SET 
    status = 'in_progress'::assist_status,
    started_at = NOW()
  WHERE id = p_assist_id 
  AND status = 'confirmed'
  AND helper_id = (SELECT id FROM profiles WHERE user_id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."start_assist"("p_assist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_active_neighborhood_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If membership becomes active, point the profile to that neighborhood
  IF (NEW.status = 'active') THEN
    UPDATE public.profiles 
    SET neighborhood_id = NEW.neighborhood_id 
    WHERE id = NEW.profile_id;
    
  -- If membership was active but is no longer (left or removed)
  ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active') THEN
    UPDATE public.profiles 
    SET neighborhood_id = NULL 
    WHERE id = NEW.profile_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_active_neighborhood_to_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_flags"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_user_id UUID;
  report_count INTEGER;
BEGIN
  -- 1. Determine which user we are auditing
  -- If we deleted a report, we check the OLD record.
  -- Otherwise, we check the NEW record.
  IF (TG_OP = 'DELETE') THEN
    target_user_id := OLD.reported_against;
  ELSE
    target_user_id := NEW.reported_against;
  END IF;

  -- 2. Count current reports for that user
  SELECT count(*) INTO report_count 
  FROM public.issue_reports 
  WHERE reported_against = target_user_id;

  -- 3. Sync the is_flagged status
  UPDATE public.profiles 
  SET is_flagged = (report_count >= 3)
  WHERE id = target_user_id;

  RETURN NULL; -- AFTER triggers can return NULL
END;
$$;


ALTER FUNCTION "public"."sync_user_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_metadata_to_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  _profile_id UUID;
  _role public.user_role;
  _is_seed BOOLEAN;
BEGIN
  -- Fetch the latest data from the public schema
  SELECT id, role INTO _profile_id, _role 
  FROM public.profiles WHERE user_id = NEW.id;

  SELECT EXISTS(SELECT 1 FROM public.seed_users WHERE profile_id = _profile_id) INTO _is_seed;

  -- Update the Auth metadata
  NEW.raw_app_meta_data = coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'profile_id', _profile_id,
      'user_role', _role,
      'is_seed_user', _is_seed
    );

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."sync_user_metadata_to_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_assist_status"("t_assist_id" "uuid", "t_new_status" "public"."assist_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_request_id UUID;
BEGIN
  -- Get current user profile
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id;

  -- Verify user is the helper for this assist
  SELECT request_id INTO v_request_id 
  FROM public.assists 
  WHERE id = t_assist_id AND helper_id = v_profile_id;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized or assist not found';
  END IF;

  -- Update assist status
  UPDATE public.assists 
  SET 
    status = t_new_status,
    started_at = CASE WHEN t_new_status = 'in_progress' THEN now() ELSE started_at END,
    completed_at = CASE WHEN t_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = t_assist_id;

  -- If completed, mark the original request as 'archived'
  IF t_new_status = 'completed' THEN
    UPDATE public.requests 
    SET status = 'archived' 
    WHERE id = v_request_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_assist_status"("t_assist_id" "uuid", "t_new_status" "public"."assist_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_location_activation"("user_lat" double precision, "user_lng" double precision) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  target_membership RECORD;
  n_record RECORD;
  dist DECIMAL;
BEGIN
  -- 1. Find the user's pending membership
  -- We use auth.uid() directly to stay "circular-reference" free
  SELECT * INTO target_membership 
  FROM public.neighborhood_memberships 
  WHERE user_id = auth.uid() 
    AND status = 'pending_second_vouch'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'no_pending_membership';
  END IF;

  -- 2. Get the neighborhood center coordinates
  SELECT * INTO n_record 
  FROM public.neighborhoods 
  WHERE id = target_membership.neighborhood_id;

  -- 3. Calculate distance
  dist := calculate_distance(user_lat, user_lng, n_record.center_lat, n_record.center_lng);

  -- 4. Validation (0.5 mile threshold)
  IF dist <= 0.5 THEN
    -- A) Update membership to active
    UPDATE public.neighborhood_memberships 
    SET status = 'active' 
    WHERE id = target_membership.id;

    RETURN 'success';
  ELSE
    RETURN 'too_far';
  END IF;
END;$$;


ALTER FUNCTION "public"."verify_location_activation"("user_lat" double precision, "user_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vouch_via_handshake"("entered_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  target_membership_id uuid;
  target_user_id uuid;
  v_primary_vouch_by uuid;
  v_vouching_profile_id uuid;
BEGIN
  SELECT id INTO v_vouching_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  SELECT id, user_id, primary_vouch_by INTO target_membership_id, target_user_id, v_primary_vouch_by
  FROM public.neighborhood_memberships
  WHERE vouch_verification_code = entered_code 
    AND status = 'pending_second_vouch'
    AND vouch_code_expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired code.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot vouch for yourself.';
  END IF;

  IF v_primary_vouch_by = v_vouching_profile_id THEN
    RAISE EXCEPTION 'Second vouch must be by a different neighbor.';
  END IF;

  UPDATE public.neighborhood_memberships
  SET status = 'active',
      secondary_vouch_by = v_vouching_profile_id,
      vouch_verification_code = NULL 
  WHERE id = target_membership_id;

  INSERT INTO public.system_events (event_type, profile_id, metadata)
  VALUES ('membership_activated', v_target_user_id, jsonb_build_object('method', 'handshake'));

END;$$;


ALTER FUNCTION "public"."vouch_via_handshake"("entered_code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "seeker_id" "uuid" NOT NULL,
    "helper_id" "uuid" NOT NULL,
    "verification_code" "text" NOT NULL,
    "helper_shared_phone" boolean DEFAULT false,
    "helper_shared_email" boolean DEFAULT false,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expected_duration" integer NOT NULL,
    "status" "public"."assist_status" DEFAULT 'confirmed'::"public"."assist_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "offer_id" "uuid",
    CONSTRAINT "verification_code_format" CHECK (("verification_code" ~* '^[0-9]{4,6}$'::"text"))
);


ALTER TABLE "public"."assists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caregiver_relationships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "caregiver_id" "uuid" NOT NULL,
    "dependent_id" "uuid" NOT NULL,
    "approval_mode" "public"."approval_mode" DEFAULT 'must_approve'::"public"."approval_mode",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_care" CHECK (("caregiver_id" <> "dependent_id"))
);


ALTER TABLE "public"."caregiver_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."help_details" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "seeker_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "dog_size" "public"."dog_size",
    "temperament" "text"[],
    "special_needs" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."help_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "neighborhood_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "code_format" CHECK (("code" ~* '^[A-Z0-9]{6,8}$'::"text"))
);


ALTER TABLE "public"."invite_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "assist_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reported_against" "uuid" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "neighborhood_id" "uuid"
);


ALTER TABLE "public"."issue_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."neighborhood_memberships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "neighborhood_id" "uuid" NOT NULL,
    "primary_vouch_by" "uuid",
    "secondary_vouch_by" "uuid",
    "status" "public"."membership_status" DEFAULT 'pending_location'::"public"."membership_status",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "vouch_verification_code" "text",
    "vouch_code_expires_at" timestamp with time zone
);


ALTER TABLE "public"."neighborhood_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."neighborhoods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "center_lat" numeric(10,8) NOT NULL,
    "center_lng" numeric(11,8) NOT NULL,
    "radius_miles" numeric(4,2) DEFAULT 0.5,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "map_image_url" "text",
    CONSTRAINT "valid_radius" CHECK (("radius_miles" > (0)::numeric))
);


ALTER TABLE "public"."neighborhoods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "helper_id" "uuid" NOT NULL,
    "note" "text",
    "share_phone" boolean DEFAULT false,
    "share_email" boolean DEFAULT false,
    "status" "public"."offer_status" DEFAULT 'pending'::"public"."offer_status",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "display_name" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "location_verified" boolean DEFAULT false,
    "location_verified_at" timestamp with time zone,
    "rate" numeric(10,2),
    "is_available" boolean DEFAULT true,
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_flagged" boolean DEFAULT false,
    "neighborhood_id" "uuid",
    CONSTRAINT "positive_rate" CHECK ((("rate" IS NULL) OR ("rate" >= (0)::numeric)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profile_details" AS
 SELECT "p"."id" AS "profile_id",
    "p"."display_name",
    "p"."role",
    "p"."address",
    "u"."email",
    "u"."phone"
   FROM ("public"."profiles" "p"
     JOIN "auth"."users" "u" ON (("p"."user_id" = "u"."id")));


ALTER VIEW "public"."profile_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profile_with_stats" AS
 SELECT "id",
    "user_id",
    "role",
    "display_name",
    "phone",
    "address",
    "location_verified",
    "location_verified_at",
    "rate",
    "is_available",
    "bio",
    "created_at",
    "updated_at",
    "is_flagged",
    "neighborhood_id",
    ( SELECT "count"(*) AS "count"
           FROM "public"."assists" "a"
          WHERE (("a"."helper_id" = "p"."user_id") AND ("a"."status" = 'completed'::"public"."assist_status"))) AS "total_assists"
   FROM "public"."profiles" "p";


ALTER VIEW "public"."profile_with_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "seeker_id" "uuid" NOT NULL,
    "neighborhood_id" "uuid" NOT NULL,
    "duration" integer NOT NULL,
    "timeframe" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "street_name" "text" NOT NULL,
    "full_address" "text" NOT NULL,
    "status" "public"."request_status" DEFAULT 'active'::"public"."request_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "help_detail_id" "uuid",
    "category_id" "text" NOT NULL,
    "action_id" "text" NOT NULL,
    "request_type" "text" NOT NULL,
    "subject_tag" "text",
    "details" "text",
    "snapshot_data" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "check_request_type" CHECK (("request_type" = ANY (ARRAY['item'::"text", 'service'::"text"])))
);


ALTER TABLE "public"."requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seed_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "neighborhood_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seed_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" "text" NOT NULL,
    "neighborhood_id" "uuid",
    "profile_id" "uuid",
    "user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_assist_details" AS
 SELECT "a"."id",
    "a"."status",
    "a"."created_at",
    "a"."started_at",
    "a"."completed_at",
    "a"."expected_duration",
    "a"."verification_code",
    "r"."id" AS "request_id",
    "r"."category_id",
    "r"."action_id",
    "r"."request_type",
    "r"."subject_tag",
    "r"."details",
    "r"."timeframe" AS "scheduled_time",
    "r"."snapshot_data",
    "r"."seeker_id",
    "ps"."display_name" AS "seeker_name",
    "r"."full_address" AS "seeker_address",
    "a"."helper_id",
    "ph"."display_name" AS "helper_name",
    "ph"."phone" AS "helper_phone",
    "uh"."email" AS "helper_email",
    "us"."email" AS "seeker_email"
   FROM ((((("public"."assists" "a"
     JOIN "public"."requests" "r" ON (("a"."request_id" = "r"."id")))
     JOIN "public"."profiles" "ps" ON (("r"."seeker_id" = "ps"."id")))
     JOIN "public"."profiles" "ph" ON (("a"."helper_id" = "ph"."id")))
     JOIN "auth"."users" "us" ON (("ps"."user_id" = "us"."id")))
     JOIN "auth"."users" "uh" ON (("ph"."user_id" = "uh"."id")));


ALTER VIEW "public"."view_assist_details" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assists"
    ADD CONSTRAINT "assists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caregiver_relationships"
    ADD CONSTRAINT "caregiver_relationships_caregiver_id_dependent_id_key" UNIQUE ("caregiver_id", "dependent_id");



ALTER TABLE ONLY "public"."caregiver_relationships"
    ADD CONSTRAINT "caregiver_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_details"
    ADD CONSTRAINT "help_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_reports"
    ADD CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."neighborhoods"
    ADD CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seed_users"
    ADD CONSTRAINT "seed_users_neighborhood_id_profile_id_key" UNIQUE ("neighborhood_id", "profile_id");



ALTER TABLE ONLY "public"."seed_users"
    ADD CONSTRAINT "seed_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_assists_helper" ON "public"."assists" USING "btree" ("helper_id");



CREATE INDEX "idx_assists_helper_history" ON "public"."assists" USING "btree" ("helper_id", "status");



CREATE INDEX "idx_assists_offer_id" ON "public"."assists" USING "btree" ("offer_id");



CREATE INDEX "idx_assists_request" ON "public"."assists" USING "btree" ("request_id");



CREATE INDEX "idx_assists_seeker" ON "public"."assists" USING "btree" ("seeker_id");



CREATE INDEX "idx_assists_status" ON "public"."assists" USING "btree" ("status");



CREATE INDEX "idx_caregiver_relationships_caregiver" ON "public"."caregiver_relationships" USING "btree" ("caregiver_id");



CREATE INDEX "idx_caregiver_relationships_dependent" ON "public"."caregiver_relationships" USING "btree" ("dependent_id");



CREATE INDEX "idx_help_details_seeker" ON "public"."help_details" USING "btree" ("seeker_id");



CREATE INDEX "idx_invite_codes_code" ON "public"."invite_codes" USING "btree" ("code");



CREATE INDEX "idx_invite_codes_expires" ON "public"."invite_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_invite_codes_neighborhood" ON "public"."invite_codes" USING "btree" ("neighborhood_id");



CREATE INDEX "idx_issue_reports_against" ON "public"."issue_reports" USING "btree" ("reported_against");



CREATE INDEX "idx_issue_reports_assist" ON "public"."issue_reports" USING "btree" ("assist_id");



CREATE INDEX "idx_memberships_neighborhood" ON "public"."neighborhood_memberships" USING "btree" ("neighborhood_id");



CREATE INDEX "idx_memberships_status" ON "public"."neighborhood_memberships" USING "btree" ("status");



CREATE INDEX "idx_neighborhoods_created_by" ON "public"."neighborhoods" USING "btree" ("created_by");



CREATE INDEX "idx_neighborhoods_location" ON "public"."neighborhoods" USING "btree" ("center_lat", "center_lng");



CREATE INDEX "idx_offers_helper" ON "public"."offers" USING "btree" ("helper_id");



CREATE INDEX "idx_offers_pending_lookup" ON "public"."offers" USING "btree" ("request_id") WHERE ("status" = 'pending'::"public"."offer_status");



CREATE INDEX "idx_offers_status" ON "public"."offers" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_only_one_active_assist_per_request" ON "public"."assists" USING "btree" ("request_id") WHERE ("status" <> 'cancelled'::"public"."assist_status");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_requests_expires" ON "public"."requests" USING "btree" ("expires_at");



CREATE INDEX "idx_requests_feed_optimized" ON "public"."requests" USING "btree" ("neighborhood_id", "status", "timeframe", "created_at" DESC) WHERE ("status" = 'active'::"public"."request_status");



CREATE INDEX "idx_requests_help_detail_id" ON "public"."requests" USING "btree" ("help_detail_id");



CREATE INDEX "idx_requests_neighborhood" ON "public"."requests" USING "btree" ("neighborhood_id");



CREATE INDEX "idx_requests_seeker" ON "public"."requests" USING "btree" ("seeker_id");



CREATE INDEX "idx_requests_seeker_history" ON "public"."requests" USING "btree" ("seeker_id", "status");



CREATE INDEX "idx_requests_status" ON "public"."requests" USING "btree" ("status");



CREATE INDEX "idx_seed_users_neighborhood" ON "public"."seed_users" USING "btree" ("neighborhood_id");



CREATE INDEX "idx_seed_users_profile" ON "public"."seed_users" USING "btree" ("profile_id");



CREATE INDEX "idx_system_events_event_type" ON "public"."system_events" USING "btree" ("event_type");



CREATE INDEX "idx_system_events_neighborhood_id" ON "public"."system_events" USING "btree" ("neighborhood_id");



CREATE INDEX "idx_system_events_profile_id" ON "public"."system_events" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "idx_unique_active_offer" ON "public"."offers" USING "btree" ("request_id", "helper_id") WHERE ("status" = 'pending'::"public"."offer_status");



CREATE UNIQUE INDEX "idx_unique_membership" ON "public"."neighborhood_memberships" USING "btree" ("profile_id", "neighborhood_id");



CREATE UNIQUE INDEX "one_accepted_offer_per_request" ON "public"."offers" USING "btree" ("request_id") WHERE ("status" = 'accepted'::"public"."offer_status");



CREATE UNIQUE INDEX "unique_pending_membership" ON "public"."neighborhood_memberships" USING "btree" ("profile_id", "neighborhood_id") WHERE ("status" = 'request_pending'::"public"."membership_status");



CREATE OR REPLACE TRIGGER "delete_neighborhood_map_webhook" AFTER DELETE ON "public"."neighborhoods" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://zujegwodzuvmihglklln.supabase.co/functions/v1/delete-neighborhood-map', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1amVnd29kenV2bWloZ2xrbGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg5OTY4MSwiZXhwIjoyMDgyNDc1NjgxfQ.G06FcY5spbhzrr7Jskds7ABK05KB5P8NHH0n19Yeg0s"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "generate_join_request_notification" AFTER INSERT OR UPDATE ON "public"."neighborhood_memberships" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://zujegwodzuvmihglklln.supabase.co/functions/v1/join-request-notify', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1amVnd29kenV2bWloZ2xrbGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg5OTY4MSwiZXhwIjoyMDgyNDc1NjgxfQ.G06FcY5spbhzrr7Jskds7ABK05KB5P8NHH0n19Yeg0s"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "generate_neighborhood_map_webhook" AFTER INSERT ON "public"."neighborhoods" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://zujegwodzuvmihglklln.supabase.co/functions/v1/generate-neighborhood-map', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1amVnd29kenV2bWloZ2xrbGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg5OTY4MSwiZXhwIjoyMDgyNDc1NjgxfQ.G06FcY5spbhzrr7Jskds7ABK05KB5P8NHH0n19Yeg0s"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "tr_set_verification_code" BEFORE INSERT ON "public"."assists" FOR EACH ROW EXECUTE FUNCTION "public"."set_assist_verification_code"();



CREATE OR REPLACE TRIGGER "tr_stamp_report_neighborhood" BEFORE INSERT ON "public"."issue_reports" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_report_neighborhood"();



CREATE OR REPLACE TRIGGER "tr_sync_neighborhood_to_profile" AFTER INSERT OR UPDATE OF "status" ON "public"."neighborhood_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."sync_active_neighborhood_to_profile"();



CREATE OR REPLACE TRIGGER "tr_sync_strikes_on_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."issue_reports" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_flags"();



CREATE OR REPLACE TRIGGER "tr_update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_help_details_updated_at" BEFORE UPDATE ON "public"."help_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."assists"
    ADD CONSTRAINT "assists_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assists"
    ADD CONSTRAINT "assists_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assists"
    ADD CONSTRAINT "assists_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assists"
    ADD CONSTRAINT "assists_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caregiver_relationships"
    ADD CONSTRAINT "caregiver_relationships_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caregiver_relationships"
    ADD CONSTRAINT "caregiver_relationships_dependent_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."help_details"
    ADD CONSTRAINT "help_details_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issue_reports"
    ADD CONSTRAINT "issue_reports_assist_id_fkey" FOREIGN KEY ("assist_id") REFERENCES "public"."assists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_reports"
    ADD CONSTRAINT "issue_reports_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id");



ALTER TABLE ONLY "public"."issue_reports"
    ADD CONSTRAINT "issue_reports_reported_against_fkey" FOREIGN KEY ("reported_against") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_reports"
    ADD CONSTRAINT "issue_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_primary_vouch_by_fkey" FOREIGN KEY ("primary_vouch_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_secondary_vouch_by_fkey" FOREIGN KEY ("secondary_vouch_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."neighborhood_memberships"
    ADD CONSTRAINT "neighborhood_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."neighborhoods"
    ADD CONSTRAINT "neighborhoods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_help_detail_id_fkey" FOREIGN KEY ("help_detail_id") REFERENCES "public"."help_details"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seed_users"
    ADD CONSTRAINT "seed_users_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seed_users"
    ADD CONSTRAINT "seed_users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Anyone can view valid invite codes" ON "public"."invite_codes" FOR SELECT USING ((("expires_at" > "now"()) AND ("used_by" IS NULL)));



CREATE POLICY "Caregivers can manage relationships" ON "public"."caregiver_relationships" USING (("caregiver_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid"));



CREATE POLICY "Create offers" ON "public"."offers" FOR INSERT WITH CHECK ((("helper_id" = "public"."get_my_profile_id"()) AND ("request_id" IN ( SELECT "requests"."id"
   FROM "public"."requests"
  WHERE ("requests"."status" = 'active'::"public"."request_status"))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."requests"
  WHERE (("requests"."id" = "offers"."request_id") AND ("requests"."seeker_id" = "public"."get_my_profile_id"())))))));



CREATE POLICY "Dependents can view their caregivers" ON "public"."caregiver_relationships" FOR SELECT USING (("dependent_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid"));



CREATE POLICY "Helpers can update task progress" ON "public"."assists" FOR UPDATE USING ((("public"."get_my_profile_id"() = "helper_id") AND ("status" <> ALL (ARRAY['completed'::"public"."assist_status", 'cancelled'::"public"."assist_status"])))) WITH CHECK ((("public"."get_my_profile_id"() = "helper_id") AND ("status" = ANY (ARRAY['in_progress'::"public"."assist_status", 'completed'::"public"."assist_status", 'cancelled'::"public"."assist_status"]))));



CREATE POLICY "Involved parties can view issue reports" ON "public"."issue_reports" FOR SELECT USING ((("reported_by" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid") OR ("reported_against" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid")));



CREATE POLICY "Manage own offers" ON "public"."offers" FOR UPDATE USING ((("public"."get_my_profile_id"() = "helper_id") AND ("status" = 'pending'::"public"."offer_status"))) WITH CHECK ((("public"."get_my_profile_id"() = "helper_id") AND ("status" = 'cancelled'::"public"."offer_status")));



CREATE POLICY "Members can create invite codes" ON "public"."invite_codes" FOR INSERT WITH CHECK ((("created_by" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid") AND (EXISTS ( SELECT 1
   FROM "public"."neighborhood_memberships"
  WHERE (("neighborhood_memberships"."profile_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid") AND ("neighborhood_memberships"."neighborhood_id" = "invite_codes"."neighborhood_id") AND ("neighborhood_memberships"."status" = 'active'::"public"."membership_status"))))));



CREATE POLICY "Parties can view assist" ON "public"."assists" FOR SELECT USING ((("public"."get_my_profile_id"() = "helper_id") OR ("public"."get_my_profile_id"() = "seeker_id")));



CREATE POLICY "Seed users can view neighborhood issue reports" ON "public"."issue_reports" FOR SELECT USING (((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'is_seed_user'::"text"))::boolean = true) AND ("neighborhood_id" = ( SELECT "profiles"."neighborhood_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Seed users can view seed status" ON "public"."seed_users" FOR SELECT USING ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'is_seed_user'::"text"))::boolean = true));



CREATE POLICY "Seekers can create requests" ON "public"."requests" FOR INSERT WITH CHECK ((("seeker_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid") AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_role'::"text") = 'seeker'::"text")));



CREATE POLICY "Seekers can manage active requests" ON "public"."requests" FOR UPDATE USING ((("public"."get_my_profile_id"() = "seeker_id") AND ("status" = 'active'::"public"."request_status"))) WITH CHECK ((("public"."get_my_profile_id"() = "seeker_id") AND (("status" = 'active'::"public"."request_status") OR ("status" = ANY (ARRAY['cancelled'::"public"."request_status", 'archived'::"public"."request_status"])))));



CREATE POLICY "Seekers can manage own help details" ON "public"."help_details" USING (("seeker_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid"));



CREATE POLICY "Users can create issue reports" ON "public"."issue_reports" FOR INSERT WITH CHECK (("reported_by" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memberships" ON "public"."neighborhood_memberships" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view profiles in their neighborhoods" ON "public"."profiles" FOR SELECT USING ((("neighborhood_id" IN ( SELECT "nm"."neighborhood_id"
   FROM "public"."neighborhood_memberships" "nm"
  WHERE (("nm"."user_id" = "auth"."uid"()) AND ("nm"."status" = 'active'::"public"."membership_status")))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view their neighborhoods" ON "public"."neighborhoods" FOR SELECT USING (("id" IN ( SELECT "neighborhood_memberships"."neighborhood_id"
   FROM "public"."neighborhood_memberships"
  WHERE (("neighborhood_memberships"."profile_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'profile_id'::"text"))::"uuid") AND ("neighborhood_memberships"."status" = 'active'::"public"."membership_status")))));



CREATE POLICY "View offers" ON "public"."offers" FOR SELECT TO "authenticated" USING ((("public"."get_my_profile_id"() = "helper_id") OR (EXISTS ( SELECT 1
   FROM "public"."requests"
  WHERE (("requests"."id" = "offers"."request_id") AND ("requests"."seeker_id" = "public"."get_my_profile_id"()))))));



CREATE POLICY "View requests" ON "public"."requests" FOR SELECT USING ((("status" = 'active'::"public"."request_status") AND ("neighborhood_id" IN ( SELECT "neighborhood_memberships"."neighborhood_id"
   FROM "public"."neighborhood_memberships"
  WHERE ("neighborhood_memberships"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."assists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."caregiver_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."help_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."neighborhood_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."neighborhoods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seed_users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."assists";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."neighborhood_memberships";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."offers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."requests";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TYPE "public"."user_role" TO "service_role";
GRANT ALL ON TYPE "public"."user_role" TO "anon";
GRANT ALL ON TYPE "public"."user_role" TO "authenticated";

























































































































































GRANT ALL ON FUNCTION "public"."accept_neighborhood_offer"("target_offer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_neighborhood_offer"("target_offer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_neighborhood_offer"("target_offer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_join_request"("p_membership_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_join_request"("p_membership_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_join_request"("p_membership_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_distance"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_assist"("p_assist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_assist"("p_assist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_assist"("p_assist_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_neighborhood_request"("p_category_id" "text", "p_action_id" "text", "p_request_type" "text", "p_subject_tag" "text", "p_details" "text", "p_duration" integer, "p_scheduled_time" timestamp with time zone, "p_help_detail_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_neighborhood_request"("p_category_id" "text", "p_action_id" "text", "p_request_type" "text", "p_subject_tag" "text", "p_details" "text", "p_duration" integer, "p_scheduled_time" timestamp with time zone, "p_help_detail_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_neighborhood_request"("p_category_id" "text", "p_action_id" "text", "p_request_type" "text", "p_subject_tag" "text", "p_details" "text", "p_duration" integer, "p_scheduled_time" timestamp with time zone, "p_help_detail_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone, "p_walker_preference" "public"."walker_preference") TO "anon";
GRANT ALL ON FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone, "p_walker_preference" "public"."walker_preference") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_walk_request"("p_help_detail_id" "uuid", "p_duration" integer, "p_timeframe_type" "text", "p_scheduled_time" timestamp with time zone, "p_walker_preference" "public"."walker_preference") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_and_request_join"("user_lat" numeric, "user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_and_request_join"("user_lat" numeric, "user_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_and_request_join"("user_lat" numeric, "user_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearest_neighborhood"("user_lat" numeric, "user_lng" numeric, "max_radius_miles" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearest_neighborhood"("user_lat" numeric, "user_lng" numeric, "max_radius_miles" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearest_neighborhood"("user_lat" numeric, "user_lng" numeric, "max_radius_miles" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_verification_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_verification_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_verification_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assist_details"("t_assist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_assist_details"("t_assist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assist_details"("t_assist_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("filter_categories" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("filter_categories" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("filter_categories" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_join_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_join_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_join_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_details"("target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_details"("target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_details"("target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_email_by_profile"("target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email_by_profile"("target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email_by_profile"("target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_neighborhood"("neighborhood_name" "text", "user_lat" numeric, "user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_neighborhood"("neighborhood_name" "text", "user_lat" numeric, "user_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_neighborhood"("neighborhood_name" "text", "user_lat" numeric, "user_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."join_neighborhood"("invite_code_text" "text", "user_lat" numeric, "user_lng" numeric, "locationverified" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."join_neighborhood"("invite_code_text" "text", "user_lat" numeric, "user_lng" numeric, "locationverified" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_neighborhood"("invite_code_text" "text", "user_lat" numeric, "user_lng" numeric, "locationverified" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."request_vouch_handshake"() TO "anon";
GRANT ALL ON FUNCTION "public"."request_vouch_handshake"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_vouch_handshake"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_assist_verification_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_assist_verification_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_assist_verification_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stamp_report_neighborhood"() TO "anon";
GRANT ALL ON FUNCTION "public"."stamp_report_neighborhood"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stamp_report_neighborhood"() TO "service_role";



GRANT ALL ON FUNCTION "public"."start_assist"("p_assist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_assist"("p_assist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_assist"("p_assist_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_active_neighborhood_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_active_neighborhood_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_active_neighborhood_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_flags"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_flags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_flags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_assist_status"("t_assist_id" "uuid", "t_new_status" "public"."assist_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_assist_status"("t_assist_id" "uuid", "t_new_status" "public"."assist_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_assist_status"("t_assist_id" "uuid", "t_new_status" "public"."assist_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_location_activation"("user_lat" double precision, "user_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."verify_location_activation"("user_lat" double precision, "user_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_location_activation"("user_lat" double precision, "user_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."vouch_via_handshake"("entered_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."vouch_via_handshake"("entered_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vouch_via_handshake"("entered_code" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."assists" TO "anon";
GRANT ALL ON TABLE "public"."assists" TO "authenticated";
GRANT ALL ON TABLE "public"."assists" TO "service_role";



GRANT ALL ON TABLE "public"."caregiver_relationships" TO "anon";
GRANT ALL ON TABLE "public"."caregiver_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."caregiver_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."help_details" TO "anon";
GRANT ALL ON TABLE "public"."help_details" TO "authenticated";
GRANT ALL ON TABLE "public"."help_details" TO "service_role";



GRANT ALL ON TABLE "public"."invite_codes" TO "anon";
GRANT ALL ON TABLE "public"."invite_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."issue_reports" TO "anon";
GRANT ALL ON TABLE "public"."issue_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_reports" TO "service_role";



GRANT ALL ON TABLE "public"."neighborhood_memberships" TO "anon";
GRANT ALL ON TABLE "public"."neighborhood_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."neighborhood_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."neighborhoods" TO "anon";
GRANT ALL ON TABLE "public"."neighborhoods" TO "authenticated";
GRANT ALL ON TABLE "public"."neighborhoods" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profile_details" TO "anon";
GRANT ALL ON TABLE "public"."profile_details" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_details" TO "service_role";



GRANT ALL ON TABLE "public"."profile_with_stats" TO "anon";
GRANT ALL ON TABLE "public"."profile_with_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_with_stats" TO "service_role";



GRANT ALL ON TABLE "public"."requests" TO "anon";
GRANT ALL ON TABLE "public"."requests" TO "authenticated";
GRANT ALL ON TABLE "public"."requests" TO "service_role";



GRANT ALL ON TABLE "public"."seed_users" TO "anon";
GRANT ALL ON TABLE "public"."seed_users" TO "authenticated";
GRANT ALL ON TABLE "public"."seed_users" TO "service_role";



GRANT ALL ON TABLE "public"."system_events" TO "anon";
GRANT ALL ON TABLE "public"."system_events" TO "authenticated";
GRANT ALL ON TABLE "public"."system_events" TO "service_role";



GRANT ALL ON TABLE "public"."view_assist_details" TO "anon";
GRANT ALL ON TABLE "public"."view_assist_details" TO "authenticated";
GRANT ALL ON TABLE "public"."view_assist_details" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































CREATE TRIGGER tr_create_profile_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

CREATE TRIGGER tr_sync_metadata_to_jwt BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_metadata_to_auth();


