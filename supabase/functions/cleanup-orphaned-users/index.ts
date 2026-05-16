import { createClient } from 'npm:@supabase/supabase-js@2';

function buildCorsHeaders(req: Request) {
  const configuredOrigins = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGIN') ?? '';
  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('Origin') ?? '';
  const allowedOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : '';

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.role !== 'director') {
      throw new Error('Only directors can cleanup users');
    }

    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    const { data: dbUsers, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id');

    if (dbError) {
      throw dbError;
    }

    const dbUserIds = new Set((dbUsers || []).map((u: { id: string }) => u.id));
    const orphanedUsers = authUsers.users.filter((u: { id: string }) => !dbUserIds.has(u.id));

    const deletedUsers = [];
    for (const orphan of orphanedUsers) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
      if (!deleteError) {
        deletedUsers.push({ id: orphan.id, email: orphan.email });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orphaned_count: orphanedUsers.length,
        deleted_users: deletedUsers
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in cleanup-orphaned-users function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to cleanup users' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
