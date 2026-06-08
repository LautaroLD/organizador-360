import { createClient } from '@/lib/supabase/client';

export async function createFeedback(data: {
  type: string;
  message: string;
  metadata: unknown;
}) {
  const supabase = createClient();

  // Opcional: obtener el usuario actual si deseas asociarlo
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: result, error } = await supabase.from('feedback').insert([
    {
      type: data.type,
      message: data.message,
      metadata: data.metadata,
      user_id: user?.id || null,
    },
  ]);

  if (error) {
    throw error;
  }

  return result;
}
