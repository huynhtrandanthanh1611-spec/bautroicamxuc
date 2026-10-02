import { openSupabaseStore } from "../server/supabase-store.js";

let store;
try {
  store = openSupabaseStore({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.SUPABASE_BUCKET || "sky-images",
  });
  const result = await store.health();
  if (result.schemaVersion !== 1) throw new Error("Cấu trúc dữ liệu Supabase chưa đúng phiên bản.");
  console.log("Kết nối Supabase thành công. Cấu trúc dữ liệu đã sẵn sàng.\nKho ảnh riêng sẽ được tạo khi khởi động máy chủ lần đầu.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await store?.close();
}
