# Báo cáo kiểm thử

Kiểm tra ngày **01/10/2026**. Dự án được chạy thực tế trong môi trường Linux, Node.js 24.19.0, Chromium 153. Không chỉ kiểm tra bằng cách đọc mã nguồn.

## Bản Supabase Free — cập nhật cùng ngày

- Build production: **đạt**.
- `npm test`: **14/14 đạt**: 5 bài SQLite, 5 bài cùng tình huống qua adapter Supabase, 4 bài kiểm tra riêng về quyền, lỗi sau commit, ảnh/quota và cấu hình.
- `SKY_TEST_SUPABASE=1 CHROMIUM_EXECUTABLE_PATH=/tmp/sky-chromium npm run test:ui`: **4/4 đạt** (42,4 giây).
- UI đã kiểm tra dán ảnh và chữ thật, đủ 3 kiểu nút, lưu/reload, trình chiếu không có nút, đầy đủ nội dung không khung, bay ngẫu nhiên, nhiều context học sinh, fullscreen và dọn hiệu ứng.
- Bài Wikimedia đã tìm, tải và ghi công **ảnh thật qua Internet**.
- SQL Supabase đã chạy bằng **PostgreSQL PGlite**; SDK Supabase thật gọi lớp HTTP/Storage mô phỏng tại máy kiểm thử. Kiểm tra quyền bằng các role anon/authenticated/service_role, không chỉ nhìn giao diện. Đã kiểm tra chạy lại migration vẫn giữ dữ liệu.
- Mô phỏng mạng đứt sau khi database đã ghi lượt: gửi lại vẫn chỉ tăng bộ đếm một lần và phát lại lượt chưa gửi được lên projector, không phát trùng trong cùng phiên máy chủ.
- Đây **chưa phải xác nhận trên project Supabase hoặc Render thật**. Chưa có công cụ quản lý Supabase được cấp trong phiên hiện tại dù ứng dụng được xác nhận đã cài; chưa có khóa/tài khoản triển khai được sử dụng. Không có URL online được tạo.

## Các tình huống đã xác nhận

| Tình huống | Cách kiểm tra | Kết quả |
|---|---|---|
| Biên dịch giao diện | `npm run build` | Đạt |
| Tạo phòng và đăng nhập | API + trình duyệt | Đạt |
| Chỉnh đủ ba nút với ba kiểu hiển thị | Trình duyệt: nút 1 chữ, nút 2 ảnh, nút 3 cả hai | Đạt |
| Tải ảnh từ máy | Tệp PNG thực, kiểm tra ảnh phản hồi | Đạt |
| Dán ảnh | Clipboard thật trong Chromium, nhấn Ctrl + V tại vùng dán | Đạt |
| Dán chữ không bị chặn | Clipboard văn bản, Ctrl + V vào textarea | Đạt |
| Kéo thả ảnh | DataTransfer chứa tệp PNG qua sự kiện drop | Đạt |
| Xóa và thay ảnh | Tương tác trên giao diện rồi kiểm tra xem trước | Đạt |
| Tìm ảnh thật | Gọi Wikimedia Commons trực tiếp với `sunflower` | Đạt; 16 kết quả phù hợp ở lần kiểm tra dịch vụ |
| Chọn ảnh tìm được | Tải ảnh thật về máy chủ, chuẩn hóa WebP, lưu nguồn | Đạt |
| Trạng thái rỗng/lỗi của dịch vụ tìm ảnh | Kiểm thử xác định ở lớp dịch vụ; không thay ảnh giả vào ứng dụng | Đạt |
| Lưu và tải lại | Reload trang giáo viên, đọc lại từ SQLite | Đạt |
| Nội dung còn sau khi khởi động lại máy chủ | Dừng/khởi động lại ứng dụng trên cùng DATA_DIR | Đạt: tên phòng, nút, ảnh, bộ đếm, chống trùng |
| Thiết bị học sinh riêng | Browser context độc lập không có cookie giáo viên | Đạt |
| Bấm nhanh 10 lần | 10 thao tác trên nút học sinh | Đạt: bộ đếm +10, chỉ tạo 10 hiệu ứng tại máy bấm |
| 30 học sinh cùng bấm | 30 kết nối Socket.IO độc lập, mỗi kết nối 10 lượt | Đạt: 300 lượt, phân bố [120, 90, 90] |
| Trình chiếu nhận thời gian thực | Context riêng mở projector, đếm sự kiện/đối tượng bay | Đạt |
| Trang giáo viên nhận bộ đếm và hiệu ứng | Socket giáo viên trong phòng | Đạt |
| Cách ly phòng | Mở một projector thuộc phòng khác | Đạt: không nhận sự kiện từ phòng đang thử |
| Gửi lại một ID lượt bấm | Gửi trùng trước và sau restart | Đạt: không tăng số đếm lần hai |
| Dọn hiệu ứng | Chờ sau tối đa 5,5 giây | Đạt: không còn phần tử bay |
| Reset có xác nhận | Thử hủy và xác nhận trong trình duyệt | Đạt |
| Không cộng lượt cũ sau reset | Gửi lượt với epoch cũ | Đạt: từ chối lượt cũ, chấp nhận lượt mới |
| Học sinh không sửa được | Gọi thẳng PUT/reset/upload/search/create API và socket giáo viên không đăng nhập | Đạt: 401 hoặc từ chối handshake |
| Chống yêu cầu sửa từ website khác | Origin giả với cookie hợp lệ | Đạt: 403 |
| Kiểm tra ảnh | PNG giả chứa script, ảnh >5 MB, kiểm tra alpha/tỉ lệ ảnh hợp lệ | Đạt |
| Không dùng ảnh thuộc phòng khác | Gửi imageId không thuộc phòng đang sửa | Đạt: từ chối |
| Không thực thi HTML trong nội dung | Lưu và hiển thị `<img src=x onerror=alert(1)>` | Đạt: hiển thị nguyên văn, không có dialog script |
| Xung đột lưu | Hai lần PUT cùng version | Đạt: lần thứ hai trả 409 |
| Đăng xuất thu hồi quyền | Logout và gọi API cũ, theo dõi socket | Đạt: socket giáo viên đóng, API trả 401 |
| Giao diện 390 × 844 | Kiểm tra hình học DOM và ảnh chụp màn hình | Đạt: đúng 3 nút, không cuộn trang, không tràn ngang |
| Giao diện 740 × 360 | Kiểm tra chiều cao và ảnh chụp màn hình | Đạt: nút nằm trong màn hình |

Các bài API/Socket.IO nằm trong `tests/integration.test.mjs`, được chạy lần nữa qua `tests/supabase-integration.test.mjs`; các bài bổ sung ở `tests/supabase-security.test.mjs`. Bốn bài trình duyệt ở `tests/classroom.spec.mjs`. Bộ kiểm thử clipboard tuân thủ CSP; không nới lỏng CSP của ứng dụng.

## Những phần chưa được xác nhận trên môi trường thật của giáo viên

- **Chưa triển khai vào tài khoản Supabase và Render của bạn**. Bản mới không cần persistent disk. Cần tạo/cấu hình project Free, kết nối repository và đặt biến bí mật theo `docs/TRIEN-KHAI-MIEN-PHI.md`.
- **Chưa dùng điện thoại vật lý, mạng 4G/5G, iOS Safari hoặc máy chiếu vật lý**. Các thiết bị độc lập và kích thước màn hình đã được mô phỏng bằng browser contexts; thao tác Cmd + V trên macOS dùng cùng handler nhưng chưa được bấm trên máy Mac thật.
- **Chưa chạy Docker image** hoặc quy trình khôi phục database/Storage Supabase thật. Có Dockerfile/Compose và quy trình sao lưu; cấu hình Node chạy trực tiếp đã được kiểm tra.
- Chưa thử tải toàn trường hoặc nhiều máy chủ. Bản này chủ đích chạy một Node instance, đã kiểm thử 30 kết nối đồng thời. Không coi con số đó là cam kết tải tối đa trên mọi gói hosting.
- Không có API key dịch vụ ảnh cần bạn bổ sung. Wikimedia đã được gọi thật thành công, nhưng dịch vụ bên ngoài vẫn có thể hết hạn mức hoặc gián đoạn sau thời điểm kiểm tra.

## Lệnh tái kiểm tra

```bash
npm ci
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:ui
# Trên bash, chạy UI qua PostgreSQL PGlite + adapter Supabase:
SKY_TEST_SUPABASE=1 npm run test:ui
```

Máy chủ UI test dùng dữ liệu tạm và mật khẩu thử nghiệm cố định chỉ trong tiến trình kiểm thử, không phải mật khẩu triển khai. Trong môi trường kiểm tra hiện tại, bản tải Chromium mặc định từ CDN không giải nén được, nên bộ kiểm thử dùng Chromium cục bộ qua `CHROMIUM_EXECUTABLE_PATH`; đây chỉ là cấu hình công cụ kiểm thử, không phải phụ thuộc của website.
