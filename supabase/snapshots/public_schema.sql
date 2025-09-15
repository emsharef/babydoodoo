

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."role_kind" AS ENUM (
    'parent',
    'caregiver'
);


ALTER TYPE "public"."role_kind" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") RETURNS TABLE("baby_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_baby uuid;
  v_role public.invites."role"%TYPE;
  v_role_typename text;
begin
  select i.baby_id, i."role"
    into v_baby, v_role
    from public.invites i
   where i.id = p_invite_id
     and lower(i.email) = lower(p_email)
     and i.status = 'pending'
   for update;
  if not found then
    raise exception 'INVITE_NOT_FOUND_OR_NOT_OWNED_OR_NOT_PENDING' using errcode = 'P0001';
  end if;

  select a.atttypid::regtype::text
    into v_role_typename
    from pg_attribute a
   where a.attrelid = 'public.memberships'::regclass
     and a.attname = 'role'
     and not a.attisdropped;

  if v_role_typename is null then
    raise exception 'MEMBERSHIPS_ROLE_COLUMN_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_role_typename = 'text' then
    execute
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::text, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email
       returning baby_id'
    into baby_id
    using v_baby, p_user_id, v_role, p_email, p_user_id;
  else
    execute format(
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::%s, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email
       returning baby_id',
      v_role_typename
    )
    into baby_id
    using v_baby, p_user_id, v_role, p_email, p_user_id;
  end if;

  update public.invites
     set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
   where id = p_invite_id;

  -- Guarantee a row is returned
  return query select baby_id;
end;
$_$;


ALTER FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."babies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."babies" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_baby"("p_name" "text") RETURNS "public"."babies"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_baby public.babies%rowtype;
  v_role_typename text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.babies (user_id, name)
  values (auth.uid(), p_name)
  returning * into v_baby;

  -- Determine memberships.role type (enum or text)
  select a.atttypid::regtype::text
    into v_role_typename
    from pg_attribute a
   where a.attrelid = 'public.memberships'::regclass
     and a.attname = 'role'
     and not a.attisdropped;

  if v_role_typename = 'text' then
    execute
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::text, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email'
    using v_baby.id, auth.uid(), 'parent', (auth.jwt() ->> 'email'), auth.uid();
  else
    execute format(
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::%s, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email',
      v_role_typename
    ) using v_baby.id, auth.uid(), 'parent', (auth.jwt() ->> 'email'), auth.uid();
  end if;

  return v_baby;
end;
$_$;


ALTER FUNCTION "public"."create_baby"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_baby uuid;
  v_role public.invites."role"%TYPE;
  v_email text;
  v_uid uuid;
  v_role_typename text;
begin
  select baby_id, "role", email, accepted_by
    into v_baby, v_role, v_email, v_uid
    from public.invites
   where id = p_invite_id
     and status = 'accepted'
     and accepted_by is not null;
  if not found then
    raise exception 'INVITE_NOT_ACCEPTED_OR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select a.atttypid::regtype::text into v_role_typename
    from pg_attribute a
   where a.attrelid = 'public.memberships'::regclass
     and a.attname = 'role'
     and not a.attisdropped;

  if v_role_typename = 'text' then
    execute
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::text, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email'
    using v_baby, v_uid, v_role, v_email, v_uid;
  else
    execute format(
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::%s, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email',
      v_role_typename
    ) using v_baby, v_uid, v_role, v_email, v_uid;
  end if;

  return v_baby;
end;
$_$;


ALTER FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.invites i where i.baby_id = p_baby_id and i.accepted_by = p_user_id and i.status::text = 'accepted');
$$;


ALTER FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.memberships m where m.baby_id = p_baby_id and m.user_id = p_user_id);
$$;


ALTER FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.babies b where b.id = p_baby_id and b.user_id = p_user_id);
$$;


ALTER FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_baby_owner(p_baby_id, p_user_id)
      or public.has_membership(p_baby_id, p_user_id)
      or public.has_accepted_invite(p_baby_id, p_user_id);
$$;


ALTER FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (mem_user_id = p_user_id)
      or public.is_baby_owner(mem_baby_id, p_user_id)
      or public.is_parent_for_baby(mem_baby_id, p_user_id);
$$;


ALTER FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.memberships m where m.baby_id = p_baby_id and m.user_id = p_user_id and m.role::text = 'parent');
$$;


ALTER FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_invite_accepted_membership_upsert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_role_typename text;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'accepted' and NEW.accepted_by is not null then
    select a.atttypid::regtype::text
      into v_role_typename
      from pg_attribute a
     where a.attrelid = 'public.memberships'::regclass
       and a.attname = 'role'
       and not a.attisdropped;

    if v_role_typename is null then
      raise exception 'MEMBERSHIPS_ROLE_COLUMN_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_role_typename = 'text' then
      execute
        'insert into public.memberships (baby_id, user_id, "role", email, created_by)
         values ($1, $2, $3::text, $4, $5)
         on conflict (baby_id, user_id) do update
           set "role" = excluded."role", email = excluded.email'
      using NEW.baby_id, NEW.accepted_by, NEW."role", NEW.email, NEW.accepted_by;
    else
      execute format(
        'insert into public.memberships (baby_id, user_id, "role", email, created_by)
         values ($1, $2, $3::%s, $4, $5)
         on conflict (baby_id, user_id) do update
           set "role" = excluded."role", email = excluded.email',
        v_role_typename
      )
      using NEW.baby_id, NEW.accepted_by, NEW."role", NEW.email, NEW.accepted_by;
    end if;
  end if;
  return NEW;
end;
$_$;


ALTER FUNCTION "public"."on_invite_accepted_membership_upsert"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baby_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "baby_id" "uuid" NOT NULL,
    "role" "public"."role_kind" NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by" "uuid"
);


ALTER TABLE "public"."baby_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "baby_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "baby_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "baby_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."role_kind" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


ALTER TABLE ONLY "public"."babies"
    ADD CONSTRAINT "babies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."baby_invites"
    ADD CONSTRAINT "baby_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."baby_invites"
    ADD CONSTRAINT "baby_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_baby_id_user_id_key" UNIQUE ("baby_id", "user_id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



CREATE INDEX "events_baby_time_idx" ON "public"."events" USING "btree" ("baby_id", "occurred_at" DESC);



CREATE INDEX "invites_baby_idx" ON "public"."baby_invites" USING "btree" ("baby_id");



CREATE INDEX "invites_code_idx" ON "public"."baby_invites" USING "btree" ("code");



CREATE INDEX "invites_email_idx" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "memberships_baby_user_idx" ON "public"."memberships" USING "btree" ("baby_id", "user_id");



CREATE OR REPLACE TRIGGER "trg_invite_accepted_membership" AFTER UPDATE ON "public"."invites" FOR EACH ROW EXECUTE FUNCTION "public"."on_invite_accepted_membership_upsert"();



ALTER TABLE ONLY "public"."babies"
    ADD CONSTRAINT "babies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."baby_invites"
    ADD CONSTRAINT "baby_invites_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."baby_invites"
    ADD CONSTRAINT "baby_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."baby_invites"
    ADD CONSTRAINT "baby_invites_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."babies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "babies_delete_owner" ON "public"."babies" FOR DELETE USING ("public"."is_baby_owner"("id", "auth"."uid"()));



CREATE POLICY "babies_insert_self" ON "public"."babies" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "babies_select_member_or_owner" ON "public"."babies" FOR SELECT USING ("public"."is_baby_visible_to_user"("id"));



CREATE POLICY "babies_update_parent_or_owner" ON "public"."babies" FOR UPDATE USING (("public"."is_baby_owner"("id", "auth"."uid"()) OR "public"."is_parent_for_baby"("id", "auth"."uid"()))) WITH CHECK (("public"."is_baby_owner"("id", "auth"."uid"()) OR "public"."is_parent_for_baby"("id", "auth"."uid"())));



ALTER TABLE "public"."baby_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete_parent_or_own" ON "public"."events" FOR DELETE USING (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "events_insert_member_or_owner" ON "public"."events" FOR INSERT WITH CHECK (("public"."has_membership"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"())));



CREATE POLICY "events_select_member_or_owner" ON "public"."events" FOR SELECT USING (("public"."has_membership"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"())));



CREATE POLICY "events_update_parent_or_own" ON "public"."events" FOR UPDATE USING (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"()))) WITH CHECK (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invites_insert_parent" ON "public"."baby_invites" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."memberships" "me"
  WHERE (("me"."baby_id" = "baby_invites"."baby_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = 'parent'::"public"."role_kind")))));



CREATE POLICY "invites_insert_parent_or_owner" ON "public"."invites" FOR INSERT WITH CHECK (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"())));



CREATE POLICY "invites_select_all" ON "public"."baby_invites" FOR SELECT USING (true);



CREATE POLICY "invites_select_parent_or_invitee" ON "public"."invites" FOR SELECT USING (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"()) OR ("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "invites_update_accept_by_invitee" ON "public"."invites" FOR UPDATE USING (("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text")))) WITH CHECK ((("status" = 'accepted'::"text") AND ("accepted_by" = "auth"."uid"())));



CREATE POLICY "invites_update_redeem" ON "public"."baby_invites" FOR UPDATE USING (("redeemed_at" IS NULL)) WITH CHECK ((("redeemed_by" = "auth"."uid"()) AND ("redeemed_at" IS NOT NULL)));



CREATE POLICY "invites_update_revoke_by_parent" ON "public"."invites" FOR UPDATE USING (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"()))) WITH CHECK (("status" = 'revoked'::"text"));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_delete_parent_or_self" ON "public"."memberships" FOR DELETE USING (("public"."is_baby_owner"("baby_id", "auth"."uid"()) OR "public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "memberships_insert_parent_or_invitee" ON "public"."memberships" FOR INSERT WITH CHECK (("public"."is_parent_for_baby"("baby_id", "auth"."uid"()) OR "public"."is_baby_owner"("baby_id", "auth"."uid"()) OR (("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."invites" "i"
  WHERE (("i"."baby_id" = "memberships"."baby_id") AND ("lower"("i"."email") = "lower"(("auth"."jwt"() ->> 'email'::"text"))) AND ("i"."status" = 'pending'::"text") AND ("i"."role" = ("memberships"."role")::"text")))))));



CREATE POLICY "memberships_select_visible" ON "public"."memberships" FOR SELECT USING ("public"."is_membership_visible_to_user"("baby_id", "user_id"));



CREATE POLICY "memberships_update_parent_or_owner" ON "public"."memberships" FOR UPDATE USING (("public"."is_baby_owner"("baby_id", "auth"."uid"()) OR "public"."is_parent_for_baby"("baby_id", "auth"."uid"()))) WITH CHECK (("public"."is_baby_owner"("baby_id", "auth"."uid"()) OR "public"."is_parent_for_baby"("baby_id", "auth"."uid"())));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_tx"("p_invite_id" "uuid", "p_user_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON TABLE "public"."babies" TO "authenticated";
GRANT ALL ON TABLE "public"."babies" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_baby"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_baby"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_baby"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_baby"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_membership_for_invite"("p_invite_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_accepted_invite"("p_baby_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_membership"("p_baby_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_baby_owner"("p_baby_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_baby_visible_to_user"("p_baby_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_membership_visible_to_user"("mem_baby_id" "uuid", "mem_user_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_parent_for_baby"("p_baby_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_invite_accepted_membership_upsert"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_invite_accepted_membership_upsert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_invite_accepted_membership_upsert"() TO "service_role";



GRANT ALL ON TABLE "public"."baby_invites" TO "anon";
GRANT ALL ON TABLE "public"."baby_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."baby_invites" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



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






RESET ALL;
