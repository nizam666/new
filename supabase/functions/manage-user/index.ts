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

interface CreateUserRequest {
  employee_id: string;
  password: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
  salary?: number;
  salary_department?: string;
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
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requester) {
      throw new Error('Unauthorized');
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', requester.id)
      .single();

    if (userData?.role !== 'director') {
      throw new Error('Only directors can manage users');
    }

    if (req.method === 'DELETE') {
      const { id } = await req.json();
      if (!id) throw new Error('User ID is required for deletion');

      // 1. Delete from Auth
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (deleteAuthError) {
        console.warn('Auth user might already be gone:', deleteAuthError.message);
      }

      // 2. Delete from users table
      const { error: deleteDbError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id);

      if (deleteDbError) throw deleteDbError;

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: CreateUserRequest = await req.json();

    if (!requestData.employee_id) {
      throw new Error('Employee ID is required');
    }

    // Check if user already exists with this employee_id in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('employee_id', requestData.employee_id)
      .maybeSingle();

    if (existingUser) {
      throw new Error('A user with this Employee ID already exists in the system');
    }

    // Use provided email or generate a dummy internal email for Supabase Auth
    const userEmail = requestData.email && requestData.email.trim() !== ''
      ? requestData.email.trim()
      : `${requestData.employee_id.replace(/\s+/g, '').toLowerCase()}@sribaba-internal.com`;

    let authUser;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: requestData.password,
      email_confirm: true,
      user_metadata: {
        full_name: requestData.full_name,
        role: requestData.role,
        email: userEmail,
        phone: requestData.phone || '',
        employee_id: requestData.employee_id,
      },
    });

    if (createError) {
      // SELF-HEALING LOGIC: If email is taken, check if it's an orphan ghost account
      if (createError.message.toLowerCase().includes('already been registered')) {
        console.log('Detected potential ghost user for email:', userEmail);
        
        // Find the ghost user by email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw createError; // Fallback to original error

        const ghost = users.find(u => u.email === userEmail);
        if (ghost) {
          // Check if this ghost exists in the users table
          const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', ghost.id)
            .maybeSingle();

          if (!dbUser) {
            console.log('Ghost confirmed (no DB record). Cleaning up Auth user:', ghost.id);
            await supabaseAdmin.auth.admin.deleteUser(ghost.id);
            
            // Try creating again
            const { data: retryNewUser, error: retryError } = await supabaseAdmin.auth.admin.createUser({
              email: userEmail,
              password: requestData.password,
              email_confirm: true,
              user_metadata: {
                full_name: requestData.full_name,
                role: requestData.role,
                email: userEmail,
                phone: requestData.phone || '',
                employee_id: requestData.employee_id,
              },
            });
            if (retryError) throw retryError;
            authUser = retryNewUser.user;
          } else {
            throw createError; // It's a real user, re-throw
          }
        } else {
          throw createError;
        }
      } else {
        throw createError;
      }
    } else {
      authUser = newUser.user;
    }

    if (!authUser) {
      throw new Error('Failed to create user - no user returned');
    }

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        email: userEmail,
        employee_id: requestData.employee_id,
        full_name: requestData.full_name,
        role: requestData.role,
        phone: requestData.phone || null,
        is_active: true,
        salary: requestData.salary || 0,
        salary_department: requestData.salary_department || 'Quarry',
      });

    if (insertError) {
      console.error('Failed to insert user record, cleaning up auth user:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw new Error(`DB Error: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, user: authUser }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in manage-user function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : JSON.stringify(error) }),
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
