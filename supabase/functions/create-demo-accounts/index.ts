import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  role: 'contractor' | 'crusher_manager' | 'manager' | 'sales' | 'director';
  phone?: string;
}

const demoAccounts: DemoUser[] = [
  {
    email: 'director@quarryerp.com',
    password: 'Director@123',
    full_name: 'Managing Director',
    role: 'director',
    phone: '+1-555-0001'
  },
  {
    email: 'admin@quarryerp.com',
    password: 'Admin@123',
    full_name: 'Admin Director',
    role: 'director',
    phone: '+1-555-0002'
  },
  {
    email: 'manager@quarryerp.com',
    password: 'Manager@123',
    full_name: 'Operations Manager',
    role: 'manager',
    phone: '+1-555-0003'
  },
  {
    email: 'contractor@quarryerp.com',
    password: 'Contractor@123',
    full_name: 'Quarry Contractor',
    role: 'contractor',
    phone: '+1-555-0004'
  },
  {
    email: 'crusher@quarryerp.com',
    password: 'Crusher@123',
    full_name: 'Crusher Manager',
    role: 'crusher_manager',
    phone: '+1-555-0005'
  },
  {
    email: 'sales@quarryerp.com',
    password: 'Sales@123',
    full_name: 'Sales Representative',
    role: 'sales',
    phone: '+1-555-0006'
  }
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const results = [];
    const errors = [];

    for (const account of demoAccounts) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUsers?.users?.some(u => u.email === account.email);

        if (userExists) {
          results.push({
            email: account.email,
            status: 'already_exists',
            message: 'User already exists'
          });
          continue;
        }

        // Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            full_name: account.full_name,
            role: account.role
          }
        });

        if (authError) {
          errors.push({
            email: account.email,
            error: authError.message
          });
          continue;
        }

        // Insert user profile into users table
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email: account.email,
            full_name: account.full_name,
            role: account.role,
            phone: account.phone,
            is_active: true
          });

        if (profileError) {
          errors.push({
            email: account.email,
            error: `Auth created but profile failed: ${profileError.message}`
          });
          continue;
        }

        results.push({
          email: account.email,
          status: 'created',
          role: account.role,
          message: 'User created successfully'
        });

      } catch (err) {
        errors.push({
          email: account.email,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors,
        summary: {
          total: demoAccounts.length,
          created: results.filter(r => r.status === 'created').length,
          existing: results.filter(r => r.status === 'already_exists').length,
          failed: errors.length
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error creating demo accounts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});