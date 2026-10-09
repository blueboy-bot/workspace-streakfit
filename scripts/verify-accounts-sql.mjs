// Execute the migration on a local PostgreSQL WASM engine. Supabase auth objects
// below are fixtures; live Supabase/OTP deployment is a separate validation.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modulePath=process.env.PGLITE_MODULE_PATH;
if(!modulePath)throw Error('Set PGLITE_MODULE_PATH to the installed @electric-sql/pglite dist/index.js');
const {PGlite}=await import(pathToFileURL(modulePath));
const db=new PGlite();
let checks=0;
await db.exec(`create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;
create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const sql=await readFile(new URL('../supabase/migrations/202610090001_accounts.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql);checks++;
const a='11111111-2222-4333-8444-555555555555',b='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',c='12345678-1234-4123-8123-123456789abc';
await db.query('insert into auth.users values($1,now(),null),($2,null,now()),($3,null,null)',[a,b,c]);
async function identity(uid){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');}
const save=(revision,data)=>db.query('select public.save_streakfit_data($1,$2::jsonb) result',[revision,JSON.stringify(data)]);
async function denied(fn,code){await assert.rejects(fn,error=>error.code===code);checks++;}
await identity(a);assert.equal((await save(0,{profile:{name:'A'},history:{}})).rows[0].result.revision,1);checks++;
await denied(()=>save(0,{profile:{},history:{}}),'PT409');
assert.equal((await save(1,{profile:{name:'A2'},history:{}})).rows[0].result.revision,2);checks++;
await denied(()=>save(1,{profile:{},history:{}}),'PT409');
for(const data of [null,{},[],{profile:{},history:null},{history:{}},{profile:[],history:{}}])await denied(()=>save(2,data),'PT400');
await identity(b);assert.equal((await db.query('select * from public.streakfit_user_data')).rows.length,0);checks++;
await denied(()=>db.query('update public.streakfit_user_data set revision=99'),'42501');
await denied(()=>db.query('select * from streakfit_private.signup_tickets'),'42501');
assert.equal((await save(0,{profile:{name:'B'},history:{}})).rows[0].result.revision,1);checks++;
await identity(c);await denied(()=>save(0,{profile:{},history:{}}),'PT401');
await db.exec('reset role;set role anon');await denied(()=>db.query('select * from public.streakfit_user_data'),'42501');await denied(()=>save(0,{profile:{},history:{}}),'42501');
await db.exec('reset role;set role service_role');
const hash='a'.repeat(64),email='person@example.com';
const ticket=(await db.query('select public.reserve_streakfit_signup_ticket($1,$2,$3) ticket',['email',email,hash])).rows[0].ticket;
await db.exec('reset role;set role supabase_auth_admin');
const hook=async event=>(await db.query('select public.streakfit_before_user_created($1::jsonb) result',[JSON.stringify(event)])).rows[0].result;
assert.ok((await hook({user:{email,user_metadata:{}}})).error);checks++;
assert.ok((await hook({user:{email:'other@example.com',user_metadata:{streakfit_signup_ticket:ticket}}})).error);checks++;
assert.deepEqual(await hook({user:{email,user_metadata:{streakfit_signup_ticket:ticket}}}),{});checks++;
assert.ok((await hook({user:{email,user_metadata:{streakfit_signup_ticket:ticket}}})).error);checks++;
await db.exec('reset role;set role service_role');
await db.query('select public.reserve_streakfit_signup_ticket($1,$2,$3)',['email',email,hash]);await db.query('select public.reserve_streakfit_signup_ticket($1,$2,$3)',['email',email,hash]);
await denied(()=>db.query('select public.reserve_streakfit_signup_ticket($1,$2,$3)',['email',email,hash]),'PT429');
await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);assert.equal((await db.query('select * from public.streakfit_user_data where user_id=$1',[a])).rows.length,0);checks++;
await db.close();console.log(`PASS: ${checks} PostgreSQL migration, RLS, verification, ticket and revision checks (local engine).`);
