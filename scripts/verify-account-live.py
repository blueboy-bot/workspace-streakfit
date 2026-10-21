"""Verify deployed auth, revision conflicts and account isolation with disposable users."""
import json, os, secrets, urllib.request, urllib.error
from pathlib import Path
config=json.loads((Path(__file__).resolve().parents[1]/'account-config.json').read_text())
base=config['projectUrl']; anon=config['publishableKey']; ref=base.split('//')[1].split('.')[0]
def call(url,token,key,method='GET',data=None):
 req=urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+token,'apikey':key,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=30) as r: return r.status,json.loads(r.read() or 'null')
 except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or '{}')
status,keys=call('https://api.supabase.com/v1/projects/'+ref+'/api-keys',os.environ['SUPABASE_ACCESS_TOKEN'],anon)
assert status==200
admin=next(k['api_key'] for k in keys if k['name']=='service_role')
users=[]
try:
 tokens=[]
 for _ in range(2):
  email='streakfit-check-'+secrets.token_hex(8)+'@example.com'; password='Aa1!'+secrets.token_urlsafe(24)
  status,ticket=call(base+'/rest/v1/rpc/reserve_streakfit_signup_ticket',admin,admin,'POST',{'p_channel':'email','p_identity':email,'p_ip_hash':secrets.token_hex(32)})
  assert status==200,('signup ticket',status)
  status,user=call(base+'/auth/v1/admin/users',admin,admin,'POST',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'streakfit_signup_ticket':ticket}})
  assert status in (200,201),('create test user',status,user.get('msg'),user.get('message'))
  users.append(user['id'])
  status,session=call(base+'/auth/v1/token?grant_type=password',anon,anon,'POST',{'email':email,'password':password})
  assert status==200,('login',status)
  tokens.append(session['access_token'])
 payload={'profile':{'name':'Disposable verification'},'history':{}}
 status,revision=call(base+'/rest/v1/rpc/save_streakfit_data',tokens[0],anon,'POST',{'payload':payload,'expected_revision':0})
 assert status==200 and revision=={'revision':1},('first save',status,revision)
 status,rows=call(base+'/rest/v1/streakfit_user_data?select=data,revision',tokens[0],anon)
 assert status==200 and rows[0]['data']==payload
 status,rows=call(base+'/rest/v1/streakfit_user_data?select=data,revision',tokens[1],anon)
 assert status==200 and rows==[],('account isolation',status)
 status,value=call(base+'/rest/v1/rpc/save_streakfit_data',tokens[0],anon,'POST',{'payload':payload,'expected_revision':0})
 assert status==409,('stale write',status)
 status,value=call(base+'/rest/v1/rpc/save_streakfit_data',tokens[0],anon,'POST',{'payload':payload,'expected_revision':1})
 assert status==200 and value=={'revision':2}
 status,_=call(base+'/rest/v1/streakfit_user_data?select=data',anon,anon)
 assert status in (401,403),('anonymous access',status)
 status,_=call(base+'/rest/v1/streakfit_user_data',tokens[0],anon,'POST',{'user_id':users[1],'data':payload})
 assert status in (401,403),('direct write forbidden',status)
 print('PASS: password login, save/read, account isolation, stale-write rejection, revision update, anonymous denial, direct-write denial')
finally:
 for user_id in users:
  status,_=call(base+'/auth/v1/admin/users/'+user_id,admin,admin,'DELETE')
  if status not in (200,204): raise RuntimeError('Disposable user cleanup failed')
 print('Disposable verification users removed')
