-- Run on the Supabase project, not on GitHub Pages. No credentials are stored here.
create schema if not exists streakfit_private;
revoke all on schema streakfit_private from public, anon, authenticated;

create table if not exists streakfit_private.signup_tickets (
  ticket uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','phone')),
  identity text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);
revoke all on streakfit_private.signup_tickets from public, anon, authenticated;
create index if not exists signup_ticket_rate on streakfit_private.signup_tickets (ip_hash,created_at);

create or replace function public.reserve_streakfit_signup_ticket(p_channel text,p_identity text,p_ip_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ticket_id uuid; a bigint; b bigint;
begin
  if p_channel is null or p_identity is null or p_ip_hash is null or p_channel not in ('email','phone') or length(p_identity) not between 8 and 254 or length(p_ip_hash)<>64 then
    raise sqlstate 'PT400' using message='Invalid signup identity';
  end if;
  a := hashtextextended('streakfit-ip:'||p_ip_hash,0);
  b := hashtextextended('streakfit-identity:'||p_identity,0);
  perform pg_advisory_xact_lock(least(a,b));
  perform pg_advisory_xact_lock(greatest(a,b));
  delete from streakfit_private.signup_tickets where created_at < now()-interval '24 hours';
  if (select count(*) from streakfit_private.signup_tickets where ip_hash=p_ip_hash and created_at>now()-interval '15 minutes')>=6
    or (select count(*) from streakfit_private.signup_tickets where identity=p_identity and created_at>now()-interval '15 minutes')>=3 then
    raise sqlstate 'PT429' using message='请求过于频繁，请稍后再试。';
  end if;
  insert into streakfit_private.signup_tickets(channel,identity,ip_hash)
    values(p_channel,p_identity,p_ip_hash) returning ticket into ticket_id;
  return ticket_id;
end $$;
revoke all on function public.reserve_streakfit_signup_ticket(text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_streakfit_signup_ticket(text,text,text) to service_role;

-- Only the gateway can issue a one-use ticket AFTER validating the plaintext password.
-- A direct request to Auth signup cannot bypass STREAKFIT's repeated-digit rule.
create or replace function public.streakfit_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ticket_id uuid; matched uuid;
begin
  begin ticket_id := (event->'user'->'user_metadata'->>'streakfit_signup_ticket')::uuid;
  exception when others then return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','请从 STREAKFIT 注册页面创建账号。')); end;
  update streakfit_private.signup_tickets set consumed_at=now()
    where ticket=ticket_id and consumed_at is null and expires_at>now()
      and ((channel='email' and identity=lower(event->'user'->>'email'))
        or (channel='phone' and replace(identity,'+','')=replace(event->'user'->>'phone','+','')))
    returning ticket into matched;
  if matched is null then
    return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','注册请求已失效，请从 STREAKFIT 重新开始。'));
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.streakfit_before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.streakfit_before_user_created(jsonb) to supabase_auth_admin;

create table if not exists public.streakfit_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check(revision>0),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=8388608),
  updated_at timestamptz not null default now()
);
alter table public.streakfit_user_data enable row level security;
revoke all on public.streakfit_user_data from public,anon,authenticated;
grant select on public.streakfit_user_data to authenticated;
drop policy if exists streakfit_own_data on public.streakfit_user_data;
create policy streakfit_own_data on public.streakfit_user_data for select to authenticated using(user_id=(select auth.uid()));

-- Writes only through this RPC: require contact verification and compare revisions atomically.
create or replace function public.save_streakfit_data(expected_revision bigint,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); next_revision bigint;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and (email_confirmed_at is not null or phone_confirmed_at is not null)) then
    raise sqlstate 'PT401' using message='请先验证邮箱或手机号。';
  end if;
  if expected_revision<0 or expected_revision is null or jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'profile') is distinct from 'object' or jsonb_typeof(payload->'history') is distinct from 'object'
    or octet_length(payload::text)>8388608 then
    raise sqlstate 'PT400' using message='训练数据格式无效或超过8MB。';
  end if;
  if expected_revision=0 then
    insert into public.streakfit_user_data(user_id,revision,data) values(uid,1,payload)
      on conflict(user_id) do nothing returning revision into next_revision;
  else
    update public.streakfit_user_data set revision=revision+1,data=payload,updated_at=now()
      where user_id=uid and revision=expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise sqlstate 'PT409' using message='其他设备已更新记录，请先处理同步冲突。'; end if;
  return jsonb_build_object('revision',next_revision);
end $$;
revoke all on function public.save_streakfit_data(bigint,jsonb) from public,anon;
grant execute on function public.save_streakfit_data(bigint,jsonb) to authenticated;
