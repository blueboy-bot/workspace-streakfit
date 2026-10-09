begin;
insert into auth.users (id,email_confirmed_at) values ('d0390da5-5d19-4560-aa23-692bb7a4cf01',now()),('d0390da5-5d19-4560-aa23-692bb7a4cf02',now()),('d0390da5-5d19-4560-aa23-692bb7a4cf03',null);
select set_config('request.jwt.claim.sub','d0390da5-5d19-4560-aa23-692bb7a4cf01',true);
set local role authenticated;
do $$
declare r jsonb;begin
 r:=public.save_streakfit_data(0,'{"profile":{},"history":{}}');
 if r->>'revision'<>'1' then raise exception 'initial revision failed';end if;
 r:=public.save_streakfit_data(1,'{"profile":{},"history":{}}');
 if r->>'revision'<>'2' then raise exception 'update revision failed';end if;
 begin perform public.save_streakfit_data(1,'{"profile":{},"history":{}}');raise exception 'stale write accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.save_streakfit_data(2,'{"profile":{}}');raise exception 'invalid data accepted';exception when sqlstate 'PT400' then null;end;
 begin update public.streakfit_user_data set revision=99;raise exception 'direct write accepted';exception when insufficient_privilege then null;end;
 begin perform * from streakfit_private.signup_tickets;raise exception 'private tickets readable';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','d0390da5-5d19-4560-aa23-692bb7a4cf02',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.streakfit_user_data) then raise exception 'other account readable';end if;
 perform public.save_streakfit_data(0,'{"profile":{},"history":{}}');
 if (select count(*) from public.streakfit_user_data)<>1 then raise exception 'own account isolation failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','d0390da5-5d19-4560-aa23-692bb7a4cf03',true);
set local role authenticated;
do $$begin
 begin perform public.save_streakfit_data(0,'{"profile":{},"history":{}}');raise exception 'unverified user accepted';exception when sqlstate 'PT401' then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform * from public.streakfit_user_data;raise exception 'anonymous read accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_streakfit_data(0,'{"profile":{},"history":{}}');raise exception 'anonymous write accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
select set_config('streakfit.test_ticket',public.reserve_streakfit_signup_ticket('email','streakfit-check@example.invalid',repeat('a',64))::text,true);
reset role;
do $$begin if not has_function_privilege('supabase_auth_admin','public.streakfit_before_user_created(jsonb)','EXECUTE') then raise exception 'auth hook permission missing';end if;end $$;
do $$declare e jsonb;r jsonb;begin
 e:=jsonb_build_object('user',jsonb_build_object('email','streakfit-check@example.invalid','user_metadata',jsonb_build_object('streakfit_signup_ticket',current_setting('streakfit.test_ticket'))));
 r:=public.streakfit_before_user_created('{"user":{"email":"streakfit-check@example.invalid","user_metadata":{}}}');
 if not r ? 'error' then raise exception 'hook accepted missing ticket';end if;
 r:=public.streakfit_before_user_created(e);
 if r<>'{}'::jsonb then raise exception 'hook rejected valid ticket';end if;
 r:=public.streakfit_before_user_created(e);
 if not r ? 'error' then raise exception 'hook accepted reused ticket';end if;
end $$;
reset role;
rollback;
select 'PASS: 15 remote PostgreSQL assertions; fixtures rolled back; no email or SMS sent' as result;
