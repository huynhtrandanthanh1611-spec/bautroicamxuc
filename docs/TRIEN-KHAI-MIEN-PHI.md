# Đưa Bầu trời cảm xúc lên mạng miễn phí

Bản cập nhật ngày 01/10/2026 dùng **Render Free + Supabase Free**. Supabase giữ phòng, bộ đếm và ảnh; Render chạy website và truyền sticker theo thời gian thực. Cần cả hai dịch vụ để bản code này hoạt động online. Không chọn Starter, Pro, Disk hoặc Render Postgres cho phương án này.

Miễn phí trong hạn mức hiện hành của nhà cung cấp. Bản code không mua gói hoặc tự nâng cấp tài khoản. Chưa có link online cho tới khi hoàn tất triển khai và kiểm tra trên dịch vụ thật.

## 1. Cập nhật thư mục đang có trên Windows

1. Trong Terminal đang chạy website, nhấn **Ctrl + C** để dừng.
2. Sao chép cả thư mục dự án hiện tại thành một thư mục dự phòng.
3. Giải nén `bau-troi-cam-xuc-supabase-free.zip` bằng **Extract All / Giải nén tất cả**.
4. Mở thư mục `bau-troi-cam-xuc` vừa giải nén. Đây là nơi có `package.json`, các thư mục `src`, `server`, `supabase` và tệp `render.yaml`.
5. Sao chép **nội dung bên trong** thư mục này vào thư mục dự án cũ đang có `package.json`. Nếu Windows hỏi, chọn **Replace the files in the destination**. Bản tải về không chứa `.env`, `data` hoặc `node_modules`, vì vậy các tệp dữ liệu riêng không bị thay thế.
6. Trong VS Code, mở Terminal tại thư mục dự án, chạy từng dòng:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run dev
```

Trên Windows, dùng `npm.cmd` để tránh lỗi PowerShell chặn `npm.ps1`. Trên macOS/Linux có thể dùng `npm`.

Chế độ mặc định vẫn dùng dữ liệu SQLite trên máy. Website thử tại http://localhost:5173/teacher. Giữ nguyên `.env` cũ nếu chưa muốn chuyển sang Supabase. `localhost` chưa phải link để học sinh ở thiết bị khác mở qua Internet.

## 2. Tạo một project Supabase Free

1. Mở https://supabase.com/dashboard và đăng nhập. Bạn có thể dùng tài khoản GitHub.
2. Chọn hoặc tạo một **Organization** có gói **Free**.
3. Chọn **New project**. Đặt tên `bau-troi-cam-xuc`.
4. Tạo mật khẩu database mạnh, lưu riêng. Đây không phải mật khẩu vào trang giáo viên.
5. Chọn khu vực gần Việt Nam, ví dụ **Singapore**, rồi tạo project. Chờ project sẵn sàng.
6. Nếu hiện yêu cầu nâng lên Pro vì đã hết số project Free, dừng tại đó; không nâng cấp và không xóa project cũ đang dùng. Kiểm tra hạn mức của tài khoản trước.

Nên dùng project riêng cho website này. Nếu đã có project cùng tên, kiểm tra nội dung và dùng lại đúng project, không tạo trùng.

## 3. Tạo cấu trúc dữ liệu — chỉ cần làm một lần

1. Trong VS Code, mở thư mục `supabase` → tệp **`001_sky.sql`**.
2. Bấm vào nội dung tệp, nhấn **Ctrl + A**, rồi **Ctrl + C**.
3. Trên trang Supabase của đúng project, vào **SQL Editor → New query**.
4. Dán toàn bộ nội dung vừa sao chép, rồi bấm **Run**.
5. Chờ thông báo thành công. Nếu báo lỗi, giữ lại nội dung lỗi để kiểm tra; không bỏ bớt đoạn cấp quyền ở cuối tệp.

Các bảng được đặt trong schema riêng `sky_app`. Bảng có RLS và không cấp quyền cho người truy cập công khai. Chỉ máy chủ của website dùng khóa bí mật để truy cập. Không cần bật Supabase Realtime, vì ứng dụng đang dùng Socket.IO trên Render.

Kho ảnh **Private** tên `sky-images` sẽ được máy chủ tạo qua API khi khởi động lần đầu. Không cần tạo policy cho học sinh và không cần chuyển bucket sang Public.

## 4. Lấy hai thông tin kết nối

Trong project Supabase:

- **Project URL**: địa chỉ dạng `https://...supabase.co`. Tìm trong **Connect** hoặc **Integrations → Data API**.
- **Secret key**: vào **Settings → API Keys**, tạo/lấy Secret key bắt đầu bằng `sb_secret_`. Nếu project chỉ có khóa cũ, `service_role` cũng được hỗ trợ. **Không dùng publishable key hoặc anon key**.

Chỉ dán Secret key vào `.env` riêng trên máy hoặc mục **Environment** của Render. Không gửi khóa qua chat, không chụp màn hình chứa khóa, không đặt trong `src`, không thêm tiền tố `VITE_`, không đưa vào GitHub hay link học sinh.

## 5. Kiểm tra Supabase từ máy tính trước

Trong `.env` đang nằm cạnh `package.json`, thêm hoặc sửa các dòng dưới đây. Thay phần ví dụ bằng thông tin thật, mỗi biến chỉ xuất hiện một lần:

```dotenv
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://ma-project-cua-ban.supabase.co
SUPABASE_SECRET_KEY=sb_secret_khoa_rieng_cua_ban
SUPABASE_BUCKET=sky-images
```

Giữ nguyên `TEACHER_PASSWORD`, `PORT=3001`, `NODE_ENV=development`, `TRUST_PROXY=0`. Để trống `PUBLIC_URL` khi thử bằng localhost. Nhấn **Ctrl + S** rồi chạy:

```powershell
npm.cmd run check:supabase
npm.cmd run dev
```

Lệnh đầu cần báo kết nối thành công. Lệnh thứ hai kiểm tra và tạo kho ảnh. Mở trang giáo viên, tạo một phòng thử, tải một ảnh, lưu rồi tải lại trang. Thử dừng và chạy lại máy chủ: phòng và ảnh phải còn.

**Phòng SQLite cũ không tự chuyển sang Supabase.** Dữ liệu cũ vẫn nằm trong `data/sky.sqlite`. Cách dễ nhất cho lần đầu là tạo lại phòng và tải ảnh trong chế độ Supabase. Muốn xem lại phòng cũ, dừng máy chủ, đổi `STORAGE_PROVIDER=sqlite`, rồi chạy lại. Hai chế độ có dữ liệu riêng.

## 6. Đưa mã nguồn lên GitHub

Có thể dùng GitHub Desktop tại https://desktop.github.com/ để tránh gõ lệnh Git:

1. Đăng nhập đúng tài khoản GitHub.
2. Chọn **File → New repository**, đặt tên `bau-troi-cam-xuc` và chọn chỗ lưu.
3. Sao chép mã nguồn vào repository mới. `package.json` và `render.yaml` phải nằm ngay thư mục gốc repository, không bị lồng thêm một thư mục `bau-troi-cam-xuc` bên ngoài.
4. Giữ `src`, `server`, `public`, `supabase`, `scripts`, `tests`, `docs` và các tệp cấu hình. **Không chép `.env`, `data`, `node_modules`, `backups`, `dist` hoặc kết quả kiểm thử**. `.gitignore` có sẵn giúp loại các tệp này.
5. Xem danh sách thay đổi, gõ ghi chú cập nhật rồi chọn **Commit to main**.
6. Chọn **Publish repository**; giữ repository **Private**. Cấp quyền cho Render đọc repository này ở bước tiếp theo.

Nếu đã có repository đúng dự án, cập nhật repository đó và chọn **Push origin**. Không cần tạo repository mới. GitHub chỉ giữ mã nguồn; bản này không chạy máy chủ bằng GitHub Pages.

## 7. Tạo website trên Render Free

1. Mở https://dashboard.render.com/ và đăng nhập.
2. Chọn **New → Blueprint**, kết nối GitHub và chọn repository vừa chuẩn bị.
3. Render đọc `render.yaml` trong bản mới. Kiểm tra: **một Web Service**, **plan: Free**, khu vực **Singapore**; **không có Disk hoặc Render Postgres**.
4. Điền các biến khi được hỏi:

| Tên biến | Nội dung điền |
|---|---|
| `TEACHER_PASSWORD` | Mật khẩu riêng cho giáo viên, ít nhất 12 ký tự |
| `SUPABASE_URL` | Project URL vừa lấy |
| `SUPABASE_SECRET_KEY` | Secret key vừa lấy, lưu dưới dạng biến bí mật |

Các biến còn lại đã có trong tệp: `STORAGE_PROVIDER=supabase`, `SUPABASE_BUCKET=sky-images`, `NODE_ENV=production`, `NODE_VERSION=24`, `TRUST_PROXY=1`.

Nếu máy thử và Render cùng dùng một project Supabase, hãy dùng cùng `TEACHER_PASSWORD`; hai máy chủ dùng mật khẩu khác nhau sẽ thu hồi các phiên giáo viên của nhau. Dừng máy chủ thử trước khi dùng online để mọi học sinh cùng kết nối về Render.

5. Kiểm tra dịch vụ hiển thị **Free / $0**. Nếu giao diện đưa ra dịch vụ tính tiền hoặc mở sẵn cấu hình Starter cũ, dừng và kiểm tra lại đúng tệp `render.yaml` mới.
6. Tạo Blueprint và chờ trạng thái **Live**. Dùng URL HTTPS do Render cấp. Website không cần mua tên miền.

Nếu chọn **New → Web Service** thủ công, dùng:

| Mục | Giá trị |
|---|---|
| Language | Node |
| Branch | main hoặc nhánh chứa bản mới |
| Root directory | Để trống nếu `package.json` ở gốc |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Instance type | Free |
| Instances | 1 |
| Health check | `/api/health` |

Thêm đầy đủ các biến môi trường ở trên. Không cần đặt `PORT` hoặc `PUBLIC_URL`: Render cấp cổng và `RENDER_EXTERNAL_URL` tự động. Nếu sau này dùng tên miền riêng, đặt `PUBLIC_URL` bằng đúng URL HTTPS của tên miền đó.

## 8. Lấy link học sinh và trình chiếu

1. Mở URL Render được cấp, thêm `/teacher` ở cuối.
2. Đăng nhập bằng mật khẩu giáo viên đã đặt trên Render.
3. Tạo hoặc mở phòng, chỉnh đủ ba nút rồi bấm **Lưu thay đổi**.
4. Bấm **Sao chép link học sinh** để gửi cho lớp.
5. Trên máy giáo viên, bấm **Mở trình chiếu → Toàn màn hình**. Trang trình chiếu không có ba nút bấm. Sticker cả lớp xuất hiện rải ngẫu nhiên, chữ/ảnh không nằm trong khung.

Link học sinh online bắt đầu bằng `https://` và tên miền Render, không phải `localhost` hay địa chỉ Supabase. Sau khi triển khai thành công, bạn có thể tắt VS Code; máy chủ chạy trên Render.

## 9. Kiểm tra trước khi dùng với lớp

- Dùng điện thoại mở link học sinh bằng 4G/5G; xem đúng cả ba nút và ảnh đã lưu.
- Bấm nhanh nhiều lần; sticker xuất hiện ngay trên điện thoại và truyền lên trình chiếu.
- Thử hai thiết bị học sinh cùng lúc; bộ đếm cộng đủ lượt, không phải đếm số học sinh.
- Trang trình chiếu không có ba nút; cụm chữ/ảnh hiển thị đủ và không có khung nền.
- Tải lại trang giáo viên; nội dung và số đếm còn. Thử tải ảnh, dán ảnh và tìm ảnh thật.
- Mở cửa sổ ẩn danh: link học sinh dùng ngay, nhưng đường dẫn `/teacher` vẫn yêu cầu mật khẩu.
- Khi chưa có lớp đang dùng, khởi động lại dịch vụ Render và kiểm tra phòng/ảnh còn trong Supabase.

Đã có các kiểm thử tự động trong bộ mã; vẫn phải kiểm tra những bước này trên tài khoản và mạng thật của bạn.

## 10. Hạn mức và việc cần nhớ

- Render Free nghỉ sau 15 phút không có lưu lượng đến. Lần truy cập tiếp theo có thể cần khoảng một phút để khởi động; mở trang trước giờ học vài phút.
- Supabase Free có hạn mức 500 MB database, 1 GB ảnh và hạn mức truyền dữ liệu. Project ít hoạt động trong 7 ngày có thể tạm dừng; vào Dashboard để khôi phục trước buổi học nếu cần.
- Hạn mức miễn phí có thể thay đổi. Giữ cả hai tài khoản ở gói Free; kiểm tra mục Usage định kỳ. Không nâng cấp hoặc thêm dịch vụ trả phí để xử lý một lỗi chưa được chẩn đoán.
- Ứng dụng giới hạn 40 MB ảnh/phòng và 800 MB ảnh cho bản Supabase này. Những ngưỡng đó không tính dữ liệu ứng dụng khác trong cùng tài khoản. Ảnh tải lên đã hơn 24 giờ và không còn được nút nào sử dụng sau khi bấm Lưu sẽ được dọn lúc máy chủ đang chạy.
- Khi mạng mất, học sinh vẫn thấy hiệu ứng tại chỗ; các lượt đang chờ được gửi lại trong tối đa 5 phút. Máy chiếu chỉ nhận được sau khi mạng hoạt động.
- Dùng một instance máy chủ. Nếu tự chạy nhiều máy chủ trên cùng database, bộ đếm được bảo vệ nhưng Socket.IO chưa có bộ chuyển tiếp để phát sticker qua nhiều máy chủ.

## 11. Sao lưu

Với dữ liệu SQLite cũ trên máy, `npm.cmd run backup` vẫn hoạt động khi `.env` đặt `STORAGE_PROVIDER=sqlite`.

Với Supabase Free, không coi gói Free là dịch vụ sao lưu tự động. Giữ bản gốc những ảnh đã tải lên và ghi lại cấu hình ba nút. Người hỗ trợ kỹ thuật có thể xuất database bằng hướng dẫn Supabase CLI dưới đây; cần sao lưu riêng các tệp trong bucket `sky-images`, vì bản dump database không chứa nội dung tệp Storage. Các bảng `sky_app` và cấu trúc `supabase/001_sky.sql` phải được giữ cùng bản sao lưu. Không gửi bản sao dữ liệu hoặc khóa bí mật cho học sinh.

Hướng dẫn chính thức: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## 12. Lỗi thường gặp

| Thông báo / hiện tượng | Cách xử lý |
|---|---|
| Supabase chưa có cấu trúc dữ liệu | Chạy toàn bộ `supabase/001_sky.sql` trên đúng project |
| Cần Secret key | Dùng `sb_secret_...` hoặc `service_role`, không dùng publishable/anon |
| Chưa kết nối được Supabase | Kiểm tra Project URL, Secret key, mạng và trạng thái project |
| Bucket cần Private | Trong Storage, đặt `sky-images` về Private |
| Không thấy phòng đã tạo trên máy | SQLite và Supabase là hai nơi lưu riêng; kiểm tra `STORAGE_PROVIDER` |
| Render báo thiếu mật khẩu | Đặt `TEACHER_PASSWORD` riêng dài từ 12 ký tự trong Environment |
| Render đòi trả phí / xuất hiện Disk | Kiểm tra đang dùng đúng `render.yaml` Free của bản cập nhật |
| Website mở chậm lần đầu | Chờ Render Free khởi động; mở trước giờ học |
| Mất đăng nhập khi chạy cả máy thử và online | Dùng cùng mật khẩu nếu dùng cùng project; dừng máy thử khi dùng lớp online |
| Không hiện sticker trên máy chiếu | Dùng link của cùng phòng và cùng website Render; kiểm tra trạng thái kết nối |

Tài liệu đã đối chiếu ngày 01/10/2026: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://supabase.com/pricing, https://supabase.com/docs/guides/getting-started/api-keys, https://supabase.com/docs/guides/database/functions, https://supabase.com/docs/guides/storage/buckets/fundamentals.
