// Shared by the browser and the signup gateway. Passwords are never persisted.
export function passwordIssues(value) {
  const password = typeof value === 'string' ? value : '';
  const symbols = "!@#$%^&*()_+-=[]{};'\":|<>?,./`~\\";
  return [
    [Array.from(password).length >= 11, '至少 11 个字符'],
    [/[A-Z]/.test(password), '至少一个大写字母 A–Z'],
    [/[a-z]/.test(password), '至少一个小写字母 a–z'],
    [/[0-9]/.test(password), '至少一个数字'],
    [[...password].some(c => symbols.includes(c)), '至少一个符号，例如 ! @ #'],
    [!/(\d)\1{2,}/.test(password), '同一个数字不能连续出现 3 次或更多'],
    [new TextEncoder().encode(password).length <= 72, '密码最多 72 字节']
  ].filter(([valid]) => !valid).map(([,message]) => message);
}
export function accountIdentity(value, channel) {
  const raw = String(value || '').trim();
  const kind = channel || (raw.includes('@') ? 'email' : 'phone');
  if (kind === 'email') {
    const email = raw.toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('请输入有效邮箱地址。');
    return {channel:'email', value:email};
  }
  const phone = raw.replace(/[ ()-]/g, '');
  if (kind !== 'phone' || !/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('手机号请包含国家区号，例如 +14165551234 或 +8613812345678。');
  return {channel:'phone', value:phone};
}
export function publicAccountConfig(raw) {
  if (!raw?.projectUrl || !raw?.publishableKey) return null;
  const url = new URL(raw.projectUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password) throw Error('账户服务地址无效。');
  const key = raw.publishableKey;
  if (key.startsWith('sb_secret_')) throw Error('禁止在网页放置 secret key。');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.role !== 'anon') throw Error();
    } catch { throw Error('请使用 Publishable key 或 anon public key，不能使用 service_role。'); }
  }
  return {projectUrl:url.origin, publishableKey:key};
}
