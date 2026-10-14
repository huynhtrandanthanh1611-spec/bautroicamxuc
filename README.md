# Vòng quay may mắn

Website lớp học bằng HTML, CSS và JavaScript, chạy hoàn toàn trên trình duyệt, không cần backend hay đăng nhập.

## Sử dụng

- **Giáo viên:** nhập, sửa, xóa, sắp xếp hoặc nhập nhiều dòng. **THÊM ẢNH** cho phép chọn nhiều ảnh từ thiết bị. Bấm thumbnail để thay ảnh, dấu × để bỏ ảnh, nhập tiêu đề tùy ý bên cạnh. Có thể trộn chữ và ảnh trong một vòng quay. Danh sách dài được chia trang để bảng nhập nằm gọn trong màn hình. Bản nhập và lịch sử được lưu trên thiết bị hiện tại.
- Chọn nhạc trong thẻ **Nhạc**, sau đó bấm **CHƠI**. Trang chuyển ngay sang vòng quay lớn và ẩn các công cụ giáo viên. Với phiên giáo viên ban đầu, nhấn Escape hoặc nút Quay lại của trình duyệt để trở về bảng chỉnh sửa.
- Bấm **QUAY**. Kết quả chỉ hiện sau khi dừng, đúng ô dưới kim cố định. Màn hình kết quả chỉ có nội dung đã chọn và nút **QUAY TIẾP**. Với ảnh, kết quả mở lớn phía trước vòng quay mờ, giữ tỷ lệ gốc bằng `object-fit: contain`; chỉ kèm tiêu đề đã nhập, không thêm lời khen. Nội dung được loại khỏi vòng quay khi bắt đầu lượt kế tiếp. Lượt cuối được chọn trực tiếp; sau đó nút đổi thành **CHƠI LẠI**. Xác nhận chơi lại sẽ xóa kết quả và lịch sử của vòng vừa chơi, khôi phục toàn bộ ô ngay trên trang, giữ nguyên chữ, ảnh, thứ tự, bản đang nhập và nhạc. Link chia sẻ cũng chơi lại được.
- **Chơi lại** ở màn kết quả cuối hoặc trong thẻ Lịch sử và **Xóa tất cả** đều yêu cầu xác nhận. Các nội dung trùng nhau được gộp để không chọn lại cùng nội dung.
- **SAO CHÉP LINK CHIA SẺ** áp dụng bản đang nhập và tạo link chứa toàn bộ danh sách cùng lựa chọn nhạc. Người nhận luôn mở ở chế độ Chơi. Tiến độ được giữ khi tải lại trong cùng phiên trình duyệt và không ghi đè danh sách của giáo viên.
- Nhạc chỉ bắt đầu sau thao tác người dùng. Có ba giai điệu tổng hợp, tắt toàn bộ âm thanh, âm lượng, đường dẫn nhạc HTTPS và tải tệp riêng.

## Chia sẻ nhạc

Nhạc có sẵn được lưu trong link bằng mã lựa chọn. Với nhạc riêng, dùng URL HTTPS công khai có thể phát trực tiếp. Tệp âm thanh không quá 64 KiB có thể nhúng đầy đủ vào link; tệp lớn hơn vẫn phát trên máy giáo viên nhưng cần chuyển sang URL nhạc hoặc nhạc có sẵn trước khi chia sẻ. Ứng dụng báo rõ trường hợp link quá dài, không tự bỏ nhạc khỏi dữ liệu chia sẻ.

## Lưu và chia sẻ hình ảnh

Không áp đặt số lượng ảnh trong danh sách; số mục mỗi trang tự điều chỉnh theo màn hình. Ảnh được xử lý trên thiết bị, mặc định cạnh dài tối đa 1600 px, nén WebP và giữ tỷ lệ. Trình duyệt có thể dùng PNG khi không hỗ trợ WebP. Kho IndexedDB lưu dữ liệu ảnh; danh sách cũ được đọc tự động. Ảnh và tiêu đề đã chọn được giữ trong lịch sử; các bản trùng cùng ảnh không được chọn lại.

Link ảnh mang toàn bộ dữ liệu ảnh, danh sách và nhạc ngay trong phần hash, không phụ thuộc vào máy của giáo viên hoặc một máy chủ tải ảnh. Người nhận có thể mở trên thiết bị mới. Tải lại trong cùng tab giữ tiến độ; dữ liệu tiến độ chỉ chứa mã nội dung, không sao chép ảnh vào sessionStorage.

Đường link có sức chứa hữu hạn: tối đa khoảng 1,8 triệu ký tự trong ứng dụng. Nếu cần, bản ảnh **dùng để chia sẻ** được nén thêm, không thay chất lượng ảnh đang lưu của giáo viên. Khi vẫn quá lớn, thao tác chia sẻ báo rõ cần chia thành bộ nhỏ hơn; tuyệt đối không cắt danh sách hoặc bỏ ảnh. Một số ứng dụng nhắn tin có thể giới hạn link ngắn hơn; cần sao chép nguyên vẹn đường link. Không thể bảo đảm link với số lượng ảnh vô hạn trên website tĩnh.

## Cấu trúc và triển khai

- `dist/`: website tĩnh hoàn chỉnh; mọi đường dẫn tài nguyên nội bộ đều tương đối.
- `dist/wheel-core.mjs`: lựa chọn ngẫu nhiên và hình học kim chỉ.
- `dist/share.mjs`: nén dữ liệu vào URL hash `#w3=` cho ảnh; vẫn đọc được link chữ cũ `#w2=`, không cần định tuyến máy chủ.
- `dist/wheel-motion.mjs`: vòng quay căn giữa, tận dụng diện tích màn hình và tăng/giảm tốc mượt.
- `dist/audio.js`: nhạc và hiệu ứng Web Audio.
- `dist/images.mjs`: nén ảnh, giữ tỷ lệ, tạo thumbnail cho canvas.
- `dist/storage.mjs`: lưu bộ ảnh trong IndexedDB; đọc dữ liệu chữ cũ và chỉ lưu mỗi ảnh một lần.
- `npm run dev`: xem trước bằng Vite; Vite không cần thiết khi website đã xuất bản.
- `npm test`: kiểm tra logic và link chia sẻ.
- `npm ci`: cài đúng dependencies từ lockfile (Node.js 22.12+).
- `npm run build`: kiểm tra cú pháp, đóng gói production bằng Vite với `base: './'`, rồi kiểm tra tài nguyên HTTP ở gốc và trong thư mục repository. Kết quả ở `build/`.
- `.github/workflows/pages.yml`: triển khai GitHub Pages từ nhánh `main`.

Xem [hướng dẫn GitHub Pages](DEPLOY_GITHUB_PAGES.md). Gói `release/vong-quay-may-man-github-pages.zip` chứa website sẵn dùng, không cần build.

## Kiểm tra bản chỉnh sửa

Đã kiểm tra 57.270 vị trí dừng; các lượt không trùng, trạng thái rỗng/cuối/chơi lại; link tiếng Việt, emoji, danh sách lớn, đường dẫn gốc và thư mục repository, nhạc có sẵn/URL/tệp nhúng và dữ liệu lỗi. Luồng giao diện được kiểm tra trong DOM mô phỏng: chỉnh sửa, phân trang, chia sẻ bản đang nhập, ẩn công cụ khi Chơi, không tự phát nhạc, kết quả tối giản và tiếp tục phiên sau tải lại.

Bản bổ sung ảnh đã kiểm tra tải nhiều ảnh, thay/xóa/hoàn tác, sắp xếp, tiêu đề tùy chọn, trộn chữ/ảnh, nén PNG thành WebP thật, giữ tỷ lệ ngang/dọc, lưu IndexedDB khi localStorage hết chỗ, link chứa đầy đủ ảnh và nhạc, mở trên phiên trống, tải lại và loại ảnh đã chọn.

Bản chơi lại đã kiểm tra hai vòng đầy đủ ở chế độ giáo viên và link chia sẻ, xác nhận/hủy, giữ nguyên ảnh/chữ/thứ tự/nhạc, tải lại sau khi chơi lại, và không chọn lặp trong từng vòng.

Đã bỏ nhân vật chibi và toàn bộ phần animation/tài nguyên liên quan; vòng quay được mở rộng trong màn hình. Tâm vòng quay hoàn toàn không chứa chữ hay nút; nút **QUAY** nằm riêng bên dưới và có khoảng trống dành trước trong bố cục. Bản production được kiểm tra bằng HTTP ở `/` và `/ten-repository/`, cùng luồng DOM mô phỏng chạy chính JavaScript đã build. Có màn hình thử tải lại khi khởi động lỗi thay vì để trang trắng.

Kiểm tra trực quan toàn trang bằng trình duyệt thực bị chặn trong môi trường thực hiện. Chưa xác nhận trên một địa chỉ GitHub Pages thực tế vì chưa có repository đích.

## Tài nguyên

Font Nunito: Vernon Adams / Cyreal / Jacques Le Bailly, SIL Open Font License (kèm trong assets). Giai điệu tổng hợp gốc. LZ-String dùng giấy phép MIT kèm trong `dist/vendor/`.
