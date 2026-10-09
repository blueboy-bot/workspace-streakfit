import {accountFingerprint} from './account-data.js';
// Whole-document revisions detect concurrent edits; never silently replace another device.
export function createAccountSync({read,write,storage,uid,onStatus=()=>{},onConflict=()=>{}}) {
  const metaKey='streakfit-sync-v1:'+uid;
  let meta={revision:0,pending:false},data=null,closed=false,inFlight=null,serial=0,conflicted=false;
  try{meta={...meta,...JSON.parse(storage.getItem(metaKey)||'null')};}catch{}
  function persist(){storage.setItem(metaKey,JSON.stringify(meta));}
  if(!Number.isSafeInteger(meta.revision)||meta.revision<0)meta={revision:0,pending:true};
  function changed(value){if(closed)return;data=structuredClone(value);serial++;meta.pending=true;try{persist();}catch{onStatus('pending','同步标记未保存，请先备份本机记录。');return;}onStatus(conflicted?'conflict':'pending');}
  async function flush(){
    if(closed||conflicted||!meta.pending||!data)return;
    if(inFlight)return inFlight;
    const before=serial,payload=structuredClone(data),expected=meta.revision;
    inFlight=(async()=>{
      try{
        const result=await write(expected,payload);
        if(closed)return;
        const revision=Number(result?.revision);if(!Number.isSafeInteger(revision)||revision<=expected)throw Error('同步版本无效。');meta.revision=revision;
        meta.fingerprint=accountFingerprint(payload);meta.pending=serial!==before;persist();onStatus(meta.pending?'pending':'synced');
      }catch(error){
        if(closed)return;
        meta.pending=true;
        if(error.status===409){conflicted=true;onStatus('conflict');try{const remote=await read();if(!closed)onConflict(remote,structuredClone(data));}catch{onStatus('conflict','读取其他设备记录失败，请联网后重试。');}}
        else onStatus('pending',error.message);
      }finally{inFlight=null;}
    })();
    await inFlight;
  }
  return {changed,flush,get pending(){return meta.pending;},get revision(){return meta.revision;},
    attach(value){data=structuredClone(value);},
    baseline(revision,value){if(!Number.isSafeInteger(revision)||revision<0)throw Error('同步版本无效。');meta.revision=revision;meta.pending=false;conflicted=false;if(value)meta.fingerprint=accountFingerprint(value);persist();},
    isClean(value){return !meta.pending&&meta.fingerprint===accountFingerprint(value);},
    async inspect(){return read();},
    close(){closed=true;data=null;}
  };
}
