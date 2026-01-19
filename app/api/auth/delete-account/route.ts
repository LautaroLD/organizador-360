import { supabaseAdmin  } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function DELETE() {
  const supabase = await createClient();
  const {data} = await supabase.auth.getSession()
const { session } = data;
  
  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: 'No authenticated user found' }), { status: 401 });
  }
  const { error: fetchError } = await supabaseAdmin.auth.admin.deleteUser(session.user.id);
  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ message: 'User account deleted successfully' }), { status: 200 });
}