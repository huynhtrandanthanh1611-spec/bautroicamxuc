# Đưa Vòng quay may mắn lên GitHub Pages

## Cách nhanh: dùng gói website tĩnh

1. Giải nén `vong-quay-may-man-github-pages.zip`.
2. Tải **các tệp và thư mục bên trong** lên thư mục gốc của repository GitHub. `index.html` phải nằm ngay ở gốc; không tải nguyên tệp ZIP hoặc bọc trong một thư mục khác.
3. Vào **Settings → Pages → Build and deployment**, chọn **Deploy from a branch**.
4. Chọn nhánh **main**, thư mục **/(root)**, rồi **Save**.
5. Mở địa chỉ GitHub cung cấp, thường có dạng `https://username.github.io/ten-repository/`.

Giữ nguyên `assets/`, `licenses/` và `.nojekyll`. JavaScript, CSS và ba font chữ đã nằm trong `assets/`; nhạc có sẵn và hiệu ứng được tạo bằng Web Audio, không cần tải tệp nhạc ngoài. Gói này không cần cài đặt hay chạy lệnh build. Không tải nguyên thư mục `build` lên gốc repository: hãy tải **nội dung bên trong** để `index.html` nằm đúng vị trí.

## Nếu dùng toàn bộ mã nguồn

Trong **Settings → Pages → Source**, chọn **GitHub Actions**. Workflow `.github/workflows/pages.yml` chạy khi đẩy mã lên nhánh `main`, hoặc bấm **Run workflow** trong thẻ Actions. Workflow cài đúng phiên bản bằng `npm ci`, chạy kiểm tra, build Vite và triển khai **thư mục `build/`**. Không cần khóa API hay backend. Nếu repository dùng nhánh khác, đổi `branches: [main]` trong workflow.

Kiểm tra production trên máy có Node.js 22.12+:

```sh
npm ci
npm test
npm run build
```

`vite.config.js` dùng `base: './'`, không phải `/`. Bản build kiểm tra tài nguyên, JavaScript/CSS/font, trang chính và link chia sẻ dưới cả `/` và `/ten-repository/` bằng HTTP. Không cần thay tên repository trong mã nguồn. Link dùng URL hash nên tải lại không tạo tuyến đường mới hay lỗi 404. `index.html` ở gốc mã nguồn cũng có lối vào `dist/` giữ nguyên hash nếu vô tình chọn xuất bản trực tiếp toàn bộ mã nguồn; cách khuyên dùng vẫn là workflow hoặc gói production ở trên.

## Kiểm tra sau khi xuất bản

- Mở địa chỉ chính: thấy chế độ Giáo viên; nhập nội dung, bấm **THÊM ẢNH** để chọn nhiều ảnh, thêm tiêu đề tùy ý và chọn nhạc.
- Bấm **CHƠI**: công cụ giáo viên ẩn hoàn toàn; vòng quay nằm giữa màn hình.
- Tâm vòng quay để trống; bấm **QUAY** bên dưới. Khi dừng, chỉ nội dung đã chọn hiện lớn cùng nút **QUAY TIẾP**.
- Chơi hết lượt, bấm **CHƠI LẠI** và xác nhận: toàn bộ chữ, ảnh, thứ tự và nhạc được giữ nguyên; không cần tải lại trang. Kiểm tra cả link chia sẻ.
- Quay lại chế độ Giáo viên, bấm **SAO CHÉP LINK CHIA SẺ**; link chữ có phần `#w2=`, link chứa ảnh có phần `#w3=`.
- Mở link trong tab mới: vào thẳng chế độ Chơi. Quay rồi tải lại trang: kết quả và tiến độ của phiên vẫn được giữ.
- Mở link trên một thiết bị khác để kiểm tra đủ ảnh; ảnh kết quả phải nằm gọn, không méo.
- Kiểm tra trên điện thoại và màn hình ngang; trang không cuộn.

Chọn nhạc có sẵn hoặc URL HTTPS công khai để chia sẻ thuận tiện. Tệp nhạc riêng tối đa 64 KiB có thể nhúng trong link; tệp lớn hơn cần URL nhạc. Nhạc chỉ phát sau khi người dùng tương tác. Ảnh được nén và nhúng đầy đủ trong link; không cần dịch vụ lưu ảnh. Với bộ ảnh vượt sức chứa đường link, ứng dụng báo rõ sau khi thử nén thêm. Hãy chia thành các bộ nhỏ hơn hoặc dùng URL nhạc thay cho tệp nhúng; ứng dụng không tự bỏ ảnh.

Tài liệu GitHub:
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://vite.dev/guide/static-deploy.html#github-pages
