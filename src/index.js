export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Bật CORS để Web Manager từ trình duyệt có thể gọi API vào
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Xử lý preflight request của CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;

    // 1. LẤY TOÀN BỘ DATA (GET /api/raws)
    // Frontend gọi cái này để render giao diện Folder/File
    if (path === '/api/raws' && request.method === 'GET') {
      try {
        // Lấy danh sách key từ KV
        const listed = await env.PASTE_DB.list();
        const data = {};
        
        // Duyệt qua lấy content (tạo thành cục JSON trả về)
        await Promise.all(listed.keys.map(async (k) => {
            const value = await env.PASTE_DB.get(k.name);
            data[k.name] = value;
        }));

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 2. TẠO / CHỈNH SỬA FILE & FOLDER (POST /api/raws)
    if (path === '/api/raws' && request.method === 'POST') {
      try {
        const { key, content, oldKey } = await request.json();

        if (!key) {
          return new Response(JSON.stringify({ error: 'Thiếu đường dẫn (key)' }), { status: 400, headers: corsHeaders });
        }

        // Xử lý đổi tên: Nếu sửa file và đổi tên -> Xóa file cũ
        if (oldKey && oldKey !== key) {
            await env.PASTE_DB.delete(oldKey);
        }

        // Lưu file/folder mới
        await env.PASTE_DB.put(key, content);

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 3. XÓA HÀNG LOẠT (POST /api/raws/batch-delete)
    // Xóa cùng lúc khi tick chọn nhiều file hoặc xóa cả folder
    if (path === '/api/raws/batch-delete' && request.method === 'POST') {
        try {
            const { keys } = await request.json();
            if (!Array.isArray(keys)) {
                return new Response(JSON.stringify({ error: 'Dữ liệu xóa không hợp lệ' }), { status: 400, headers: corsHeaders });
            }

            // Thực thi xóa toàn bộ các key được gửi lên
            await Promise.all(keys.map(k => env.PASTE_DB.delete(k)));

            return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
    }

    // 4. TRẢ VỀ RAW FILE CHO ROBLOX EXECUTOR (GET /folder/filename)
    // Bắt các request không phải trang chủ (/) và không chứa /api/
    if (path !== '/' && !path.startsWith('/api/')) {
        // Decode URL để đọc được thư mục chứa dấu cách (VD: "UI Scripts/main.lua")
        const itemKey = decodeURIComponent(path.slice(1)); 
        
        const rawContent = await env.PASTE_DB.get(itemKey);

        if (!rawContent) {
            return new Response('404 Not Found - Script này đã bị xóa hoặc không tồn tại!', { status: 404, headers: corsHeaders });
        }

        // Chặn không render text raw của file định dạng folder (.keep)
        if (itemKey.endsWith('/.keep')) {
            return new Response('Forbidden: Folder reference', { status: 403, headers: corsHeaders });
        }

        return new Response(rawContent, {
            status: 200,
            headers: { 
                ...corsHeaders,
                'Content-Type': 'text/plain; charset=utf-8' 
            }
        });
    }

    // Trang chủ dự phòng
    return new Response('NoirHub Raw Storage System Active!', { status: 200, headers: corsHeaders });
  }
};
