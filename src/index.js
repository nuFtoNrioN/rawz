export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Bật CORS cho phép gọi API từ mọi nơi
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ==========================================
    // 1. API LẤY TOÀN BỘ DANH SÁCH FILE/FOLDER (GET /api/raws)
    // ==========================================
    if (url.pathname === '/api/raws' && request.method === 'GET') {
      try {
        // Lấy danh sách tất cả các key lưu trong KV
        const list = await env.PASTE_DB.list();
        const result = {};

        // Đọc song song nội dung tất cả các key
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
          headers: corsHeaders
        });
      }
    }

    // ==========================================
    // 2. API LƯU/SỬA FILE HOẶC TẠO FOLDER (POST /api/raws)
    // ==========================================
    if (url.pathname === '/api/raws' && request.method === 'POST') {
      try {
        const { key, content, oldKey } = await request.json();

        if (!key) {
          return new Response(JSON.stringify({ error: 'Missing key/path' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Nếu đổi tên key/path -> Xóa key cũ đi
        if (oldKey && oldKey !== key) {
          await env.PASTE_DB.delete(oldKey);
        }

        // Lưu key mới vào KV
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
          headers: corsHeaders
        });
      }
    }

    // ==========================================
    // 3. API XÓA NHIỀU FILE / FOLDER (POST /api/raws/batch-delete)
    // ==========================================
    if (url.pathname === '/api/raws/batch-delete' && request.method === 'POST') {
      try {
        const { keys } = await request.json();

        if (!Array.isArray(keys) || keys.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid or empty keys array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Xóa tất cả key trong danh sách
        await Promise.all(keys.map(k => env.PASTE_DB.delete(k)));

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // ==========================================
    // 4. LẤY RAW FILE THEO ĐƯỜNG DẪN (GET /folder1/folder2/file.lua)
    // ==========================================
    // Decode đường dẫn URL để xử lý đúng ký tự tiếng Việt hoặc dấu cách
    const fullPath = decodeURIComponent(url.pathname.slice(1));

    if (fullPath) {
      const rawContent = await env.PASTE_DB.get(fullPath);

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

    return new Response('RawZ API Engine Active', { status: 200, headers: corsHeaders });
  }
};
