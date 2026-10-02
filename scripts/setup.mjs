import { existsSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) {
  console.log(
    "Đã có .env. Giữ nguyên cấu hình. Bạn có thể mở tệp này trong VS Code để xem/đổi mật khẩu.",
  );
} else {
  const password = randomBytes(15).toString("base64url");
  writeFileSync(
    ".env",
    `TEACHER_PASSWORD=${password}\nPORT=3001\nDATA_DIR=./data\nNODE_ENV=development\nPUBLIC_URL=\nTRUST_PROXY=0\nCOMMONS_USER_AGENT=BauTroiCamXuc/1.0 (educational classroom application)\n`,
    { mode: 0o600 },
  );
  try {
    chmodSync(".env", 0o600);
  } catch {
    /* Windows có cơ chế quyền riêng. */
  }
  console.log(
    `\nĐã tạo cấu hình. Mật khẩu giáo viên: ${password}\nLưu mật khẩu này ở nơi riêng. Không gửi cho học sinh.\nTiếp theo chạy: npm run dev\n`,
  );
}
