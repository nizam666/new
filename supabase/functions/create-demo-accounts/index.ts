const appOrigin = Deno.env.get('APP_ORIGIN');

const responseHeaders = {
  ...(appOrigin ? { 'Access-Control-Allow-Origin': appOrigin, Vary: 'Origin' } : {}),
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const preflightHeaders = {
  ...(appOrigin ? { 'Access-Control-Allow-Origin': appOrigin, Vary: 'Origin' } : {}),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Demo account creation is disabled. Create users through the authenticated manage-user function.',
    }),
    {
      status: 410,
      headers: responseHeaders,
    }
  );
});
