import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

if (process.env.STORAGE_PROVIDER === "supabase") {
  console.error("Lệnh backup này chỉ dành cho SQLite trên máy. Với Supabase, xem phần Sao lưu trong docs/TRIEN-KHAI-MIEN-PHI.md.");
  process.exit(1);
}
const directory = resolve(process.env.DATA_DIR || "./data");
const source = join(directory, "sky.sqlite");
if (!existsSync(source))
  throw new Error("Chưa có dữ liệu. Hãy chạy ứng dụng và tạo phòng trước.");
const outputDir = join(directory, "backups");
mkdirSync(outputDir, { recursive: true });
const destination = join(
  outputDir,
  `sky-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
const db = new DatabaseSync(source);
db.exec("PRAGMA busy_timeout=10000");
db.prepare("VACUUM INTO ?").run(destination);
db.close();
console.log(
  `Đã sao lưu cấu hình, ảnh và bộ đếm: ${destination}\nTải bản sao lưu về máy riêng; không chia sẻ với học sinh.`,
);
