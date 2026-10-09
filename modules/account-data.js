// JSONB can reorder object keys. Compare canonical data rather than JSON text.
export function canonicalAccountData(value) {
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,ordered(value[k])])):value;
  return JSON.stringify(ordered(value));
}
export function accountFingerprint(value) {
  const text=canonicalAccountData(value);let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return text.length+':'+(hash>>>0).toString(16);
}
