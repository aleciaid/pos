// Server-side proxy that forwards a webhook POST to an arbitrary URL.
// This avoids browser CORS preflight (OPTIONS) issues when calling
// third-party webhook receivers (e.g. n8n) directly from the frontend.
export default async (req, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const { url, auth, payload } = body || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid url' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (auth && typeof auth === 'string' && auth.trim()) {
        headers['Authorization'] = auth.trim();
    }

    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload ?? {}),
            signal: AbortSignal.timeout(10000),
        });

        let respBody = '';
        try { respBody = await upstream.text(); } catch {}
        return new Response(JSON.stringify({
            ok: upstream.ok,
            status: upstream.status,
            body: respBody.slice(0, 2000),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (err) {
        return new Response(JSON.stringify({
            ok: false,
            status: 0,
            error: err?.message || 'Upstream fetch failed',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
};
