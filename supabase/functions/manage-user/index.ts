import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: string;
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

    // Check if user already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', requestData.email)
      .maybeSingle();

    if (existingUser) {
      throw new Error('A user with this email already exists in the system');
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true,
      user_metadata: {
        full_name: requestData.full_name,
        role: requestData.role,
        phone: requestData.phone || '',
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
        email: requestData.email,
        full_name: requestData.full_name,
        role: requestData.role,
        phone: requestData.phone || null,
        is_active: true,
      });

    if (insertError) {
      console.error('Failed to insert user record, cleaning up auth user:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to create user record: ${insertError.message}`);
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create user' }),
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
