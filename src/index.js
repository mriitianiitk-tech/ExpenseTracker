export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Standard CORS headers so your app can communicate with the backend
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // D1 Sync Endpoints (/api/sync or /sync)
    if (url.pathname === "/api/sync" || url.pathname === "/sync") {
      // 1. SAVE DATA TO D1 (POST)
      if (request.method === "POST") {
        try {
          if (!env.DB) {
            return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not configured" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const bodyText = await request.text();
          
          // Ensure table exists
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
          ).run();

          // Upsert state
          await env.DB.prepare(
            "INSERT INTO store (key, data) VALUES ('app_state', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP;"
          )
            .bind(bodyText)
            .run();

          return new Response(JSON.stringify({ success: true, message: "Saved to D1" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // 2. RETRIEVE DATA FROM D1 (GET)
      if (request.method === "GET") {
        try {
          if (!env.DB) {
            return new Response(JSON.stringify({ success: false, error: "D1 database binding 'DB' not configured" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Ensure table exists
          await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
          ).run();

          const row = await env.DB.prepare("SELECT data FROM store WHERE key = 'app_state'").first();
          return new Response(row ? row.data : "{}", {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    }

    // Pass through to static assets (handled by Cloudflare Workers Assets) or 404
    return new Response("Not Found", { status: 404 });
  }
};
