# 1.0.5

- Chọn interface cho từng line WAN; từ hai line trở lên, kiểm tra Internet riêng bằng ping 8.8.8.8 qua interface đã chọn.
- Hiển thị riêng trạng thái Link và Internet; xác nhận mất line sau hai chu kỳ ping liên tiếp thất bại.
- Cảnh báo Telegram theo từng dự án khi WAN mất/phục hồi Internet hoặc router ngừng/gửi dữ liệu trở lại.
- Lưu Bot Token đã mã hóa trong `/data`; Viewer không truy cập hoặc thay đổi cấu hình Telegram.
- Bộ cài và nâng cấp collector v5 giữ nguyên khóa, không thay đổi cấu hình mạng trên MikroTik.

# 1.0.4

- Chuyển Docker base sang Node.js 22 LTS Alpine để hỗ trợ an toàn ba kiến trúc, gồm ARMv7.
- Image Docker hỗ trợ x86-64, ARM64 và ARMv7; dùng được trên Windows/macOS Docker Desktop và Linux Docker Engine.
- Thêm gói Windows 10/11 x64 portable có sẵn Node.js, mật khẩu Admin nhập kín và dữ liệu giữ trong thư mục riêng.
- GitHub Actions kiểm tra gói Windows, build đa kiến trúc và đính kèm ZIP vào GitHub Release.

# 1.0.3

- Sửa đăng nhập điện thoại và proxy: xác thực Origin hỗ trợ yêu cầu same-origin hợp lệ mà không tắt CSRF.
- Quản lý nhiều tài khoản Viewer; phân quyền độc lập cho từng dự án và từng chức năng, kiểm tra ở API.
- Banner hỗ trợ kỹ thuật do Admin tự cấu hình (tên, số điện thoại, Facebook, nội dung, vị trí và đối tượng hiển thị).
- Làm mới giao diện đăng nhập, bổ sung chân trang liên hệ, thông báo sử dụng miễn phí và tối ưu màn hình nhỏ.
- Giữ dữ liệu NetWatch cũ trong /data; tự chuyển tài khoản Viewer 1.0.2 sang định dạng mới.

# 1.0.2

- Thêm một tài khoản chỉ xem, do quản trị viên tạo/đổi mật khẩu/bật tắt trên web.
- Chặn quyền ghi tại API; tài khoản xem không nhận bộ cài hoặc khóa router.
- Giữ đăng nhập quản trị và dữ liệu cũ; lưu cấu hình viewer riêng trong /data.
- Sửa nút thêm IP/switch ảo khi truy cập trang qua HTTP.
- Build ARM64 trên runner ARM64 thật, ARMv7 qua QEMU.

# 1.0.1

- Sửa bộ cài HTTP: không truyền tùy chọn chỉ dành cho HTTPS.
- Giữ kiểm tra chứng chỉ với HTTPS, kể cả khi nâng cấp script.
- Hiển thị lỗi gửi dữ liệu gốc và sửa lệnh thoát khi collector chạy trùng.

# 1.0.0

- Đóng gói NetWatch cho HAOS và Raspberry Pi.
- Lưu dữ liệu SQLite cục bộ trong /data.
- Giữ sơ đồ thủ công, neo, điểm uốn, switch ảo và nhiều dự án.
- GitHub Actions build image ARM64/ARMv7 và kiểm tra khởi động qua QEMU.
