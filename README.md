# Bầu trời cảm xúc

Website lớp học bằng **React + Node.js + Socket.IO**, hỗ trợ **Supabase Free** khi online và **SQLite** khi thử trên máy. Học sinh chạm một trong ba nút, nội dung bay lên ngay trên thiết bị của mình và trên màn hình trình chiếu. Giáo viên có trang quản lý riêng, mật khẩu riêng và bộ đếm thời gian thực.

**Bắt đầu với [HUONG-DAN.md](HUONG-DAN.md)** nếu bạn chưa quen lập trình. Có thêm bản `HUONG-DAN.html` để nhấp đúp đọc bằng trình duyệt. Hướng dẫn trình bày từng bước bằng tiếng Việt, từ mở VS Code đến đưa website lên mạng.

**Triển khai miễn phí:** đọc [docs/TRIEN-KHAI-MIEN-PHI.md](docs/TRIEN-KHAI-MIEN-PHI.md) hoặc mở `docs/TRIEN-KHAI-MIEN-PHI.html`. `render.yaml` của bản này dùng Free, không gắn Disk.

## Chạy nhanh

Cần Node.js **24 LTS**. Mở terminal trong thư mục chứa `package.json`:

```bash
npm ci
npm run setup
npm run dev
```

Lưu mật khẩu xuất hiện sau lệnh `setup`. Mở **http://localhost:5173/teacher**, đăng nhập và tạo phòng. Mật khẩu cũng nằm trong `.env` trên máy bạn; đừng chia sẻ tệp này.

Chạy bản đã biên dịch, cùng một máy chủ cho cả giao diện và API:

```bash
npm run build
npm start
```

Mở **http://localhost:3001/teacher**. `localhost` chỉ dùng trên máy đang chạy chương trình, không phải đường link Internet để gửi học sinh.

## Đã có trong dự án

- Đúng 3 nút trên giao diện học sinh; chữ, ảnh hoặc cả hai. Giữ dòng chữ và tỉ lệ ảnh.
- Mỗi lần bấm có một đối tượng bay riêng trong 3–5 giây; xử lý nhiều lượt đồng thời; tự dọn phần tử.
- Tạo nhiều phòng có link riêng, không cần tài khoản học sinh.
- Trang giáo viên được kiểm tra phiên đăng nhập ở máy chủ. Học sinh không thể sửa cấu hình, tải ảnh hay đặt lại số đếm bằng API.
- Tải ảnh từ máy, kéo thả, dán ảnh PNG/JPG/WebP. Paste chỉ được xử lý tại vùng dán ảnh khi clipboard có ảnh.
- Tìm ảnh **thật** trên Wikimedia Commons, chọn và tải ảnh về bộ lưu trữ riêng của ứng dụng. Không cần API key.
- Chỉ đưa ra kết quả có metadata giấy phép Public domain, CC0, CC BY hoặc CC BY-SA được hỗ trợ. Lưu tác giả, giấy phép, trang nguồn và thông tin chuyển đổi ảnh; có trang ghi công công khai.
- Supabase PostgreSQL lưu phòng, bộ đếm, phiên và khóa chống trùng; Supabase Storage Private giữ ảnh. SQLite vẫn dùng được khi chạy thử trên máy. Không phụ thuộc localStorage để chia sẻ phòng.
- WebSocket với Socket.IO, hiệu ứng tại chỗ tức thì, chống hiển thị trùng và chống đếm trùng khi gửi lại.
- Lưu mới được phát cho mọi thiết bị. Phát hiện xung đột khi hai cửa sổ cùng sửa.
- Xác nhận trước khi đặt lại bộ đếm. Số đếm là lượt chạm, **không** phải số người.
- Font Nunito có tiếng Việt được đóng gói cùng ứng dụng, không cần Google Fonts khi sử dụng.

## Cấu trúc

```text
bau-troi-cam-xuc/
  src/
    App.jsx                  Các trang giáo viên, học sinh, ghi công
    api.js                   Gọi API, sao chép link, tạo ID lượt bấm
    styles.css               Bố cục điện thoại/máy tính, phong cách bầu trời
    components/
      Sky.jsx                Ba nút và hiệu ứng bay
      ImageEditor.jsx        Tải, dán, thả, tìm ảnh
      Modal.jsx              Hộp thoại có giữ focus bàn phím
    hooks/useRoom.js         Socket, kết nối lại, hàng đợi, chống echo
  server/
    app.js                   API, quyền giáo viên, Socket.IO
    store.js                 SQLite, giao dịch và bộ đếm
    supabase-store.js        PostgreSQL qua RPC + Supabase Storage Private
    images.js                Kiểm tra ảnh và tích hợp Wikimedia
    index.js                 Khởi động máy chủ
  scripts/
    setup.mjs                Tạo .env và mật khẩu ngẫu nhiên
    backup.mjs               Sao lưu SQLite an toàn khi đang chạy
    ui-test-server.mjs       Máy chủ kiểm thử tách biệt dữ liệu thật
  tests/                     Kiểm thử máy chủ và trình duyệt
  docs/KIEM-THU.md            Báo cáo kiểm thử và các giới hạn
  .env.example               Cấu hình mẫu, không phải khóa thật
  render.yaml                Render Free, không gắn Disk
  supabase/001_sky.sql        Bảng, RPC nguyên tử và quyền truy cập Supabase
  Dockerfile, compose.yaml    Cách chạy Docker tùy chọn
  package.json, package-lock.json
  HUONG-DAN.md
```

## Các đường dẫn

| Đường dẫn          | Mục đích                              | Quyền                |
| ------------------ | ------------------------------------- | -------------------- |
| `/teacher`         | Đăng nhập, tạo phòng, danh sách phòng | Mật khẩu giáo viên   |
| `/teacher/room/ID` | Chỉnh nút, xem trước, bộ đếm          | Mật khẩu giáo viên   |
| `/s/ID`            | Học sinh bấm ba nút                   | Có link phòng        |
| `/projector/ID`    | Trình chiếu hiệu ứng cả lớp           | Có link phòng        |
| `/credits/ID`      | Tác giả, nguồn, giấy phép ảnh đã chọn | Công khai theo phòng |

Một bản cài đặt dành cho một giáo viên hoặc một nhóm giáo viên **cùng quyền quản trị** dùng chung mật khẩu. Các giáo viên cần vùng quản lý độc lập nên triển khai các bản riêng. Không có mật khẩu hay token quản trị trong link học sinh.

## Lưu trữ và triển khai

- `STORAGE_PROVIDER=sqlite` (mặc định): dữ liệu thử nằm trong `DATA_DIR/sky.sqlite`. Không xóa các tệp WAL/SHM khi chương trình đang chạy.
- `STORAGE_PROVIDER=supabase`: dữ liệu nằm trong schema `sky_app`, ảnh trong bucket Private `sky-images`. Cần chạy `supabase/001_sky.sql`, đặt `SUPABASE_URL` và `SUPABASE_SECRET_KEY` ở máy chủ. Không dùng khóa ở frontend. Cấu hình thiếu/sai báo lỗi, không tự chuyển về ổ tạm.

`render.yaml` cấu hình **một Node Web Service Free + Supabase Free bên ngoài**. Không tạo Render Postgres, không gắn Disk. Đọc hướng dẫn miễn phí để tạo project, chạy SQL và lấy link online. Phòng SQLite cũ không tự di chuyển; dữ liệu cũ được giữ nguyên để giáo viên xem lại.

Chạy một instance. Bộ đếm Supabase dùng transaction và khóa hàng; nhiều instance vẫn cần bộ chuyển tiếp Socket.IO nếu muốn chia sẻ hiệu ứng giữa các máy chủ. Ảnh không dùng được dọn sau 24 giờ; ứng dụng giới hạn 40 MB/phòng, 800 MB tổng ảnh của bản Supabase. Giới hạn miễn phí vẫn phụ thuộc tài khoản và nhà cung cấp.

## Kiểm tra

```bash
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:ui
```

`npm test` kiểm tra SQLite và SQL Supabase bằng PostgreSQL PGlite, SDK Supabase thật với lớp HTTP/Storage mô phỏng. Đây không phải kiểm thử project Supabase thật. Các bài này không truy cập dịch vụ ảnh bên ngoài. Kiểm thử giao diện có một bài **gọi Wikimedia thật**, nên cần Internet. Không bỏ qua lỗi dịch vụ hoặc thay kết quả bằng ảnh giả. Đọc `docs/KIEM-THU.md` để biết chính xác những phần đã chạy và chưa chạy.

## Giới hạn có chủ đích

- 60 ký tự, tối đa 4 dòng chủ động mỗi nút; cỡ chữ cấu hình 18–36 px. Trên màn hình nhỏ, chữ tự điều chỉnh cho vừa nút.
- Ảnh nhập tối đa 5 MB, 25 triệu điểm ảnh; chỉ PNG/JPG/WebP tĩnh. Ảnh được sửa hướng EXIF, thu nhỏ trong khung 1280 × 1280, giữ tỉ lệ và độ trong suốt, chuyển WebP.
- 40 MB ảnh lưu mỗi phòng. Ảnh không được dùng sau 24 giờ được dọn. Xóa ảnh khỏi nút cần **lưu** để thay đổi xuất hiện cho học sinh.
- Tối đa 240 đối tượng bay đang hiển thị trên mỗi màn hình; khi cực đông sẽ dọn đối tượng cũ nhất để bảo vệ hiệu năng, nhưng **vẫn đếm các lượt hợp lệ**.
- Mỗi kết nối được bấm nhanh theo đợt 60 lượt, sau đó tiếp nhận 20 lượt/giây. Lượt vượt nhịp được xếp hàng và gửi lại. Không giới hạn theo IP của cả trường.
- Giữ tối đa 500 lượt chờ mỗi tab, tối đa 5 phút; lưu hàng đợi tạm trong sessionStorage. Nếu giáo viên đặt lại số đếm, các lượt cũ đang chờ sẽ không cộng vào vòng mới.
- Khi mất mạng, hiệu ứng trên máy học sinh vẫn xuất hiện và có thông báo chờ gửi. Trình chiếu chỉ nhận sự kiện khi kết nối trở lại. Bộ đếm được lấy lại từ cơ sở dữ liệu; không phát lại toàn bộ hiệu ứng lịch sử.
- Link học sinh là link công khai có ID khó đoán: ai có link đều có thể bấm. Đây là hoạt động tương tác, không phải hệ thống bầu cử xác thực danh tính.

## Tài liệu chính thức

- [Node.js](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Render: Web Services](https://render.com/docs/web-services)
- [Render: WebSockets](https://render.com/docs/websocket)
- [Supabase: gói miễn phí](https://supabase.com/pricing)
- [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Render: giới hạn dịch vụ miễn phí](https://render.com/docs/free)
- [MediaWiki: Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [MediaWiki: Search API](https://www.mediawiki.org/wiki/API:Search)
