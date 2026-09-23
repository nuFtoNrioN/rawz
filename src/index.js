export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. API GET: Lấy tất cả danh sách raw data
    if (pathname === '/api/raws' && request.method === 'GET') {
      const list = await env.PASTE_DB.list();
      const result = {};

      for (const key of list.keys) {
        const value = await env.PASTE_DB.get(key.name);
        result[key.name] = value;
      }

      return new Response(JSON.stringify(result), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    // 2. API POST: Tạo mới / Chỉnh sửa (Lưu File hoặc Folder placeholder)
    if (pathname === '/api/raws' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { key, content, oldKey } = body;

        if (!key || content === undefined) {
          return new Response(JSON.stringify({ error: 'Thiếu key hoặc content' }), { status: 400 });
        }

        // Nếu đổi tên file (oldKey tồn tại và khác key mới) -> Xóa key cũ đi
        if (oldKey && oldKey !== key) {
          await env.PASTE_DB.delete(oldKey);
        }

        // Lưu key mới vào Cloudflare KV
        await env.PASTE_DB.put(key, content);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 3. API POST: Xóa hàng loạt (Batch Delete)
    if (pathname === '/api/raws/batch-delete' && request.method === 'POST') {
      try {
        const { keys } = await request.json();
        if (Array.isArray(keys)) {
          for (const k of keys) {
            await env.PASTE_DB.delete(k);
          }
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 4. Trả về RAW TEXT cho Roblox Script / Browser khi truy cập đường dẫn thô (VD: /folder/script.lua)
    const rawKey = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    
    if (rawKey) {
      const scriptText = await env.PASTE_DB.get(rawKey);

      if (scriptText !== null) {
        // Kiểm tra User-Agent: Nếu truy cập bằng Browser -> Trả về trang 403 Access Denied
        const userAgent = request.headers.get('user-agent') || '';
        const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');

        if (isBrowser && !rawKey.startsWith('api/')) {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head><title>403 Access Denied</title></head>
            <body style="background:#0b0914;color:#ff4757;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
              <div style="text-align:center;border:1px solid #ff4757;padding:30px;border-radius:12px;background:#131021;">
                <h1>403 - ACCESS DENIED</h1>
                <p style="color:#a4b0be;">Mở Executor lên rồi paste link này vào chạy nhé bro!</p>
              </div>
            </body>
            </html>
          `, {
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        // Trả về Raw Text thô cho Roblox Executor
        return new Response(scriptText, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }

    // Mặc định trả về ứng dụng Frontend
    return env.ASSETS.fetch(request);
  }
};
