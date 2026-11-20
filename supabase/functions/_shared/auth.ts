import { createClient } from 'npm:@supabase/supabase-js@2'

export async function getUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing Authorization header')
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Authentication required')
  return data.user
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}
