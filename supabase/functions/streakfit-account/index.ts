import {createAccountGateway} from '../_shared/gateway.js';
Deno.serve(createAccountGateway({
  url:Deno.env.get('SUPABASE_URL'),
  anonKey:Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  allowedOrigins:(Deno.env.get('STREAKFIT_ALLOWED_ORIGINS')||'https://blueboy-bot.github.io').split(',')
}));
