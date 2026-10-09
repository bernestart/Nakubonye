-- Phase 11.6-UI — decline_like + delete_sent_like RPCs
-- Mirrors Facebook "Ignore" (decline received) and "Cancel Request"
-- (withdraw sent). Both are silent to the other party.

create or replace function public.decline_like(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = target_user_id then
    raise exception 'Cannot decline yourself';
  end if;

  delete from public.likes
    where user_id = target_user_id
      and liked_user_id = me;

  delete from public.matches
    where user_one_id = least(me, target_user_id)
      and user_two_id = greatest(me, target_user_id);
end;
$$;

create or replace function public.delete_sent_like(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.likes
    where user_id = me
      and liked_user_id = target_user_id;

  delete from public.matches
    where user_one_id = least(me, target_user_id)
      and user_two_id = greatest(me, target_user_id);
end;
$$;

grant execute on function public.decline_like(uuid) to authenticated;
grant execute on function public.delete_sent_like(uuid) to authenticated;
