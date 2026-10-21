// The beta copies legacy preview preferences once, then writes its own workspace.
// Older versions remain usable and cannot overwrite the beta's saved records.
(() => {
 const store=window.localStorage,prefix='streakfit-beta-v039:',legacy='streakfit-visual-v034:';
 const initialKeys=new Set(['streakfit-v1','streakfit-theme','streakfit-view-mode','streakfit-theme-profile','streakfit-language']);
 globalThis.STREAKFIT_STORAGE={
  getItem(key){
   if(store.getItem(prefix+'removed:'+key))return null;
   const own=store.getItem(prefix+key);if(own!==null)return own;
   if(!initialKeys.has(key)||store.getItem(legacy+'removed:'+key))return null;
   const value=store.getItem(legacy+key)??store.getItem(key);
   if(value!==null){try{store.setItem(prefix+key,value);}catch{/* Read remains possible; normal save reports quota failures. */}}
   return value;
  },
  setItem(key,value){store.setItem(prefix+key,value);store.removeItem(prefix+'removed:'+key);},
  removeItem(key){store.setItem(prefix+'removed:'+key,'1');store.removeItem(prefix+key);}
 };
})();
