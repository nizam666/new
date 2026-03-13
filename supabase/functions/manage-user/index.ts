import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  employee_id: string;
  password: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
}

Deno.serve(async (req: Request) => {
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
      .single();

    if (userData?.role !== 'director') {
      throw new Error('Only directors can manage users');
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
      throw createError;
    }

    if (!newUser.user) {
      throw new Error('Failed to create user - no user returned');
    }

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email: userEmail, // Still required for compatibility and uniqueness at DB level occasionally
        employee_id: requestData.employee_id,
        full_name: requestData.full_name,
        role: requestData.role,
        phone: requestData.phone || null,
        is_active: true,
      });

    if (insertError) {
      console.error('Failed to insert user record, cleaning up auth user:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`DB Error: ${insertError.message} - Details: ${JSON.stringify(insertError)}`);
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
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
