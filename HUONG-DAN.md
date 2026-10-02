# Hướng dẫn sử dụng “Bầu trời cảm xúc”

Bạn không cần viết thêm code để dùng phiên bản này. Thực hiện lần lượt các bước dưới đây. Phần A–C giúp chạy thử trên máy; phần D tạo đường link Internet cho học sinh.

## A. Chuẩn bị máy tính

1. Tải **Node.js 24 LTS** từ https://nodejs.org/ và cài đặt bằng các lựa chọn mặc định. Npm được cài cùng Node.js. Không chọn Node.js 20 hoặc bản cũ hơn vì dự án dùng SQLite tích hợp trong Node 24.
2. Tải và cài **Visual Studio Code** từ https://code.visualstudio.com/.
3. Giải nén `bau-troi-cam-xuc-supabase-free.zip`. Tìm thư mục `bau-troi-cam-xuc` chứa tệp `package.json`.
4. Mở VS Code → **File → Open Folder…** → chọn thư mục đó. Nếu hỏi có tin cậy thư mục không, chọn tin cậy sau khi đã kiểm tra đây là mã nguồn bạn tải về.
5. Chọn **Terminal → New Terminal**. Đây là ô gõ lệnh ở dưới VS Code.
6. Gõ lần lượt:

```bash
node --version
npm --version
```

Lệnh đầu cần hiện `v24...`. Nếu báo không tìm thấy lệnh, đóng và mở lại VS Code sau khi cài Node.js.

**Windows:** nếu PowerShell báo chặn `npm.ps1`, thay `npm` bằng `npm.cmd` trong từng lệnh bên dưới. Ví dụ: `npm.cmd ci`. Không cần thay đổi chính sách bảo mật toàn máy.

## B. Cài và chạy thử

Gõ từng lệnh, chờ lệnh trước chạy xong:

```bash
npm ci
npm run setup
```

- `npm ci` tải các thư viện theo phiên bản đã chốt trong `package-lock.json`.
- `npm run setup` tạo tệp `.env` và **mật khẩu giáo viên ngẫu nhiên**. Sao chép mật khẩu được in trong Terminal vào nơi riêng để dùng sau.
- Nếu đã có `.env`, lệnh setup giữ nguyên tệp. Bạn có thể mở `.env` trong VS Code để xem lại mật khẩu.
- Nếu tự dùng `.env.example`, sao chép thành `.env` và thay giá trị `TEACHER_PASSWORD` bằng mật khẩu riêng dài ít nhất 12 ký tự. Giá trị ví dụ không được chấp nhận.

Sau đó chạy:

```bash
npm run dev
```

Giữ cửa sổ Terminal chạy. Mở trình duyệt và vào:

**http://localhost:5173/teacher**

Nhập mật khẩu vừa tạo. Bạn sẽ thấy danh sách phòng và ô **Tên phòng mới**.

Muốn dừng chương trình, bấm vào Terminal rồi nhấn **Ctrl + C**. Lần sau chỉ cần mở thư mục và chạy `npm run dev`, không cần cài lại thư viện hoặc chạy setup.

### Hiểu đúng “localhost”

`localhost` nghĩa là **chính máy đang mở trình duyệt**. Link `http://localhost:5173/s/...` hoạt động trên máy giáo viên đang chạy chương trình; khi học sinh mở link đó ở nhà, thiết bị của học sinh sẽ tìm máy chủ trên chính thiết bị học sinh nên không vào được.

Muốn chia sẻ qua Internet, làm phần D. Đừng tắt máy chủ đang chạy thử rồi mong link localhost vẫn dùng được.

## C. Tạo hoạt động trong lớp

### 1. Tạo phòng

Nhập tên, ví dụ **“Lớp 1.4 — Hôm nay con thế nào?”**, rồi bấm **Tạo phòng tương tác**. Phòng được lưu ngay, có ba nút mẫu để bạn bắt đầu chỉnh sửa.

### 2. Chỉnh lần lượt ba nút

Chọn tab **Nút 1**, **Nút 2**, **Nút 3**. Mỗi tab có các lựa chọn:

| Lựa chọn  | Nội dung cần cung cấp                    |
| --------- | ---------------------------------------- |
| Chỉ chữ   | Gõ chữ; dùng Enter để xuống dòng         |
| Chỉ ảnh   | Chọn, kéo thả, dán hoặc tìm một ảnh      |
| Chữ & ảnh | Gõ chữ và thêm ảnh; cả hai bay cùng nhau |

Bạn có thể chọn màu nền, màu chữ và kéo thanh cỡ chữ. Giữ câu ngắn để học sinh đọc rõ trên điện thoại. Tối đa 60 ký tự và 4 dòng chủ động; cỡ chữ 18–36. Màn hình nhỏ tự điều chỉnh chữ để vừa nút. Nếu màu chữ gần giống màu nền, giao diện nhắc chọn màu dễ đọc hơn.

Khung bên phải là bản xem trước. Bấm nút trong khung để thử hiệu ứng; **bấm thử không tăng bộ đếm**.

### 3. Thêm ảnh bằng bốn cách

- **Tệp trên máy:** bấm **Chọn tệp**, chọn PNG/JPG/WebP. Muốn thay ảnh thì bấm **Thay ảnh**.
- **Kéo thả:** kéo tệp ảnh từ thư mục trên máy vào khung có viền nét đứt.
- **Dán ảnh:** sao chép **nội dung ảnh**, bấm vào khung có dòng “Bấm vào đây rồi nhấn Ctrl + V để dán ảnh”, sau đó nhấn Ctrl + V; trên Mac dùng Cmd + V. Có thể dùng ảnh chụp màn hình đã sao chép vào clipboard. Chép tên tệp hoặc chép URL chỉ là chép chữ, không phải dữ liệu ảnh.
- **Tìm ảnh:** bấm **Tìm ảnh trên mạng**, nhập từ khóa rồi bấm **Tìm ảnh**. Bấm ảnh thu nhỏ để sử dụng. Từ khóa tiếng Anh như `sunflower`, `smile icon`, `heart icon` có thể cho nhiều lựa chọn hơn. Nguồn là Wikimedia Commons và **không cần API key**. Chọn ảnh phù hợp với trẻ trước khi chia sẻ.

Nếu mất mạng khi tìm ảnh, website hiển thị lỗi; các cách dùng tệp, kéo thả và dán ảnh vẫn hoạt động khi trình duyệt còn kết nối được với máy chủ của website.

Ảnh tối đa 5 MB. Không dùng SVG, GIF động hoặc tệp giả ảnh. PNG trong suốt được giữ độ trong suốt. Ảnh được thu nhỏ giữ nguyên tỉ lệ, không cắt và không kéo méo.

### 4. Lưu và chia sẻ

1. Bấm **Lưu thay đổi** và chờ thông báo thành công.
2. Bấm **Sao chép link học sinh**.
3. Dán link vào nơi bạn thường gửi bài cho lớp. Học sinh mở bằng trình duyệt là dùng được, không nhập tên hoặc đăng nhập.
4. Khi sửa tiếp, nhớ **Lưu thay đổi**. Các thiết bị đang mở phòng nhận nội dung mới tự động.

Nút sao chép tạm khóa khi bạn còn sửa chưa lưu để tránh gửi nội dung cũ. Trong mục **Cách dùng trong lớp**, bạn cũng có thể chọn và sao chép đường link bằng tay.

### 5. Mở màn hình chung

Bấm **Mở trình chiếu** trên máy nối máy chiếu. Ở tab mới, có nút toàn màn hình ở góc phải. Khi bất kỳ học sinh nào bấm, nội dung bay lên màn hình này.

Giao diện học sinh luôn có ba nút cố định ở dưới; học sinh bấm liên tục hoặc đổi qua lại giữa các nút đều được. Trên trang giáo viên, bộ đếm cập nhật theo **số lượt bấm**. Một học sinh bấm 10 lần nghĩa là 10 lượt, không phải 10 học sinh.

Để bắt đầu vòng mới, bấm **Đặt lại** → đọc thông báo → **Đặt cả ba về 0**. Nội dung ba nút không mất. Không thể hoàn tác bộ đếm đã đặt lại.

## D. Đưa lên Internet miễn phí

Bản mới dùng **Render Free + Supabase Free**. Các bước chi tiết nằm trong [docs/TRIEN-KHAI-MIEN-PHI.md](docs/TRIEN-KHAI-MIEN-PHI.md); có bản HTML cùng tên để nhấp đúp mở đọc.

1. Tạo project Supabase trong organization Free.
2. Chạy toàn bộ tệp `supabase/001_sky.sql` trong SQL Editor của project.
3. Đặt Project URL và Secret key trong `.env` để thử, hoặc Environment của Render để chạy online.
4. Đưa mã nguồn lên repository GitHub riêng tư. Không đưa `.env`, `data`, `node_modules` hoặc bản sao lưu lên GitHub.
5. Tạo Render Blueprint từ `render.yaml` mới. Kiểm tra **plan Free**, không có Disk hoặc Render Postgres.
6. Sau khi Render báo Live, mở URL HTTPS được cấp + `/teacher`, tạo phòng và sao chép link học sinh.

Supabase lưu phòng/ảnh độc lập với máy chủ Render, nên không dùng ổ tạm Render để giữ dữ liệu lớp. Phòng tạo trong SQLite cũ không tự chuyển: giữ nguyên `data` để xem lại hoặc tạo lại phòng trong Supabase. Render Free có thời gian khởi động khi vừa nghỉ, Supabase Free có hạn mức và có thể tạm dừng project ít hoạt động; mở kiểm tra trước buổi học.

## E. Mật khẩu và sao lưu

### Đổi hoặc quên mật khẩu

- Chạy trên máy: mở `.env`, sửa `TEACHER_PASSWORD`, lưu tệp rồi dừng/chạy lại máy chủ.
- Chạy trên Render: mở **Environment**, thay `TEACHER_PASSWORD`, lưu và triển khai lại.
- Thay mật khẩu sẽ vô hiệu hóa phiên giáo viên cũ. Dữ liệu phòng và ảnh vẫn còn.
- Không có chức năng gửi lại mật khẩu qua email; bạn kiểm soát mật khẩu từ cấu hình máy chủ.

### Sao lưu SQLite trên máy

Nếu dùng Supabase, xem phần Sao lưu trong `docs/TRIEN-KHAI-MIEN-PHI.md`. Lệnh bên dưới chỉ dành cho SQLite.

Trong Terminal của dự án, chạy:

```bash
npm run backup
```

Tệp sao lưu được tạo trong `DATA_DIR/backups/`. Bản sao chứa phòng, ảnh và bộ đếm. Lệnh dùng `VACUUM INTO` để có bản SQLite nhất quán, kể cả khi chương trình đang chạy.

Không gửi database, `.env` hoặc bản sao lưu cho học sinh. Gói mã nguồn bàn giao không chứa mật khẩu thật hay dữ liệu lớp.

Khôi phục trên máy cá nhân: dừng chương trình; sao chép toàn bộ thư mục `data` hiện tại sang một thư mục dự phòng khác; tạo thư mục `data` mới; chép tệp backup vào đó và đặt tên `sky.sqlite`; chạy lại. Không trộn tệp `-wal`/`-shm` cũ với database vừa khôi phục.

## F. Lỗi thường gặp

| Hiện tượng                                     | Cách xử lý                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Mở `index.html` trực tiếp chỉ thấy trang trắng | Dùng `npm run dev`, hoặc `npm run build` rồi `npm start`. Đây là ứng dụng có máy chủ.                                                |
| Terminal báo thiếu mật khẩu                    | Chạy `npm run setup`; kiểm tra `.env` ở cùng thư mục với `package.json`.                                                             |
| `EADDRINUSE` hoặc cổng đã được dùng            | Dừng lần chạy cũ bằng Ctrl + C. Dev dùng 5173 và 3001. Nếu đổi cổng API phải sửa cả proxy trong `vite.config.js`.                    |
| Không lưu được nút ảnh                         | Chọn một ảnh hợp lệ trước; nút “Chỉ ảnh” và “Chữ & ảnh” cần có ảnh.                                                                  |
| Ctrl + V không có ảnh                          | Clipboard có thể chỉ chứa URL hoặc tên tệp. Sao chép chính ảnh hoặc ảnh chụp màn hình, rồi bấm đúng vùng dán ảnh.                    |
| Tìm ảnh báo lỗi                                | Kiểm tra máy chủ truy cập được `commons.wikimedia.org`, `thumb.wikimedia.org`, `upload.wikimedia.org`; thử lại hoặc dùng ảnh từ máy. |
| Có ảnh nhưng học sinh chưa thấy                | Bấm “Lưu thay đổi”; link học sinh dùng bản đã lưu, không dùng bản đang chỉnh.                                                        |
| Học sinh không mở được link localhost          | Triển khai online ở phần D; gửi link HTTPS online.                                                                                   |
| Không có hiệu ứng trên máy chiếu               | Kiểm tra đang mở đúng phòng, trạng thái kết nối và mạng có cho phép WebSocket/Socket.IO không.                                       |
| Mất ảnh sau deploy                             | Kiểm tra `STORAGE_PROVIDER=supabase` cùng Project URL; xem trạng thái project và bucket trên Supabase.                                 |
| Lưu báo xung đột                               | Có cửa sổ khác đã lưu phòng. Giữ lại phần chữ bạn cần, tải lại trang rồi sửa trên bản mới.                                           |
| Mật khẩu đúng nhưng online không giữ đăng nhập | Dùng HTTPS và đúng `PUBLIC_URL`; kiểm tra cookie không bị chặn; `TRUST_PROXY=1` trên Render.                                         |

## G. Kiểm tra kỹ thuật và chạy Docker tùy chọn

Bạn không phải chạy các bước này để sử dụng thường ngày. Dành cho người hỗ trợ kỹ thuật:

```bash
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:ui
```

Kiểm thử trình duyệt tự tạo cơ sở dữ liệu tạm; không sửa phòng thật. Bài tìm ảnh cần truy cập Internet. Xem báo cáo trong `docs/KIEM-THU.md`.

Nếu đã cài Docker Desktop, chạy `npm run setup` rồi:

```bash
docker compose up --build -d
```

Mở http://localhost:3001/teacher. Dữ liệu nằm trong named volume `sky-data`. `docker compose down` dừng dịch vụ và giữ volume; **không dùng `down -v` nếu muốn giữ dữ liệu**. Compose này dùng để thử cục bộ. Đưa Docker lên Internet cần reverse proxy HTTPS, `PUBLIC_URL`, `NODE_ENV=production`, cấu hình `TRUST_PROXY` đúng số proxy và volume bền vững. Render là cách triển khai được hướng dẫn chính cho giáo viên.

Tài liệu triển khai tham khảo, kiểm tra ngày 01/10/2026: https://render.com/docs/web-services, https://render.com/docs/disks, https://render.com/docs/websocket, https://render.com/docs/free.
