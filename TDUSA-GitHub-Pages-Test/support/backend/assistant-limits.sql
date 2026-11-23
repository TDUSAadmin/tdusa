-- Global hard cap and best-effort per-client hourly cap for the Gemini test assistant.
-- Only a server-side service role may consume quota; no prompts are stored.
create table if not exists public.tdusa_assistant_daily_usage (day date primary key, used integer not null default 0 check (used >= 0));
create table if not exists public.tdusa_assistant_hourly_usage (hour_start timestamptz not null, client_hash text not null, used integer not null default 0 check (used >= 0), primary key(hour_start,client_hash));
alter table public.tdusa_assistant_daily_usage enable row level security;
alter table public.tdusa_assistant_hourly_usage enable row level security;
revoke all on public.tdusa_assistant_daily_usage,public.tdusa_assistant_hourly_usage from public,anon,authenticated;
create or replace function public.tdusa_assistant_consume_quota(p_client_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; hr timestamptz := date_trunc('hour',now()); daily integer; hourly integer;
begin
 if p_client_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 delete from public.tdusa_assistant_daily_usage where day < today - 2;
 delete from public.tdusa_assistant_hourly_usage where hour_start < now() - interval '2 days';
 insert into public.tdusa_assistant_daily_usage(day,used) values(today,0) on conflict(day) do nothing;
 select used into daily from public.tdusa_assistant_daily_usage where day=today for update;
 if daily>=50 then return false; end if;
 insert into public.tdusa_assistant_hourly_usage(hour_start,client_hash,used) values(hr,p_client_hash,0) on conflict(hour_start,client_hash) do nothing;
 select used into hourly from public.tdusa_assistant_hourly_usage where hour_start=hr and client_hash=p_client_hash for update;
 if hourly>=8 then return false; end if;
 update public.tdusa_assistant_hourly_usage set used=used+1 where hour_start=hr and client_hash=p_client_hash;
 update public.tdusa_assistant_daily_usage set used=used+1 where day=today;
 return true;
end $$;
revoke all on function public.tdusa_assistant_consume_quota(text) from public,anon,authenticated;
grant execute on function public.tdusa_assistant_consume_quota(text) to service_role;
-- Server reads only the published committee term and filters the result before using it.
grant select on public.committee_terms to service_role;
