export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Xóa dấu / ở cuối đường dẫn nếu có
    const pathname = url.pathname.replace(/\/$/, '') || '/';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ==========================================
    // 1. API LẤY TẤT CẢ FILE/FOLDER (GET /api/rawz hoặc /rawz)
    // ==========================================
    if ((pathname === '/api/rawz' || pathname === '/rawz') && request.method === 'GET') {
      try {
        const list = await env.PASTE_DB.list();
        const result = {};

        await Promise.all(
          list.keys.map(async (k) => {
            const content = await env.PASTE_DB.get(k.name);
            result[k.name] = content || '';
          })
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==========================================
    // 2. API LƯU FILE / TẠO FOLDER (POST /api/rawz hoặc /rawz)
    // ==========================================
    if ((pathname === '/api/rawz' || pathname === '/rawz') && request.method === 'POST') {
      try {
        const { key, content, oldKey } = await request.json();

        if (!key) {
          return new Response(JSON.stringify({ error: 'Missing key/path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (oldKey && oldKey !== key) {
          await env.PASTE_DB.delete(oldKey);
        }

        await env.PASTE_DB.put(key, content || '');

        return new Response(JSON.stringify({ 
          success: true, 
          rawUrl: `${url.origin}/${key}` 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==========================================
    // 3. API XÓA NHIỀU FILE/FOLDER (POST /api/rawz/batch-delete hoặc /rawz/batch-delete)
    // ==========================================
    if ((pathname === '/api/rawz/batch-delete' || pathname === '/rawz/batch-delete') && request.method === 'POST') {
      try {
        const { keys } = await request.json();

        if (!Array.isArray(keys) || keys.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid keys array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await Promise.all(keys.map(k => env.PASTE_DB.delete(k)));

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==========================================
    // 4. LẤY RAW SCRIPT THEO PATH (GET /folder1/file.lua)
    // ==========================================
    const rawPath = decodeURIComponent(url.pathname.slice(1));

    if (rawPath) {
      const rawContent = await env.PASTE_DB.get(rawPath);

      if (rawContent !== null) {
        return new Response(rawContent, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8'
          }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
