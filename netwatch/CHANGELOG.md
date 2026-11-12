# 1.0.3

- Thêm nhiều tài khoản chỉ xem; chọn riêng dự án được phép xem cho từng tài khoản.
- Chặn truy cập chéo dự án tại API; dự án mới không tự được chia sẻ.
- Sửa quyền, đổi mật khẩu, tắt/xóa tài khoản sẽ thu hồi phiên của riêng tài khoản đó.
- Giới hạn từng tài khoản theo dự án và các mục giám sát; dữ liệu API cũng được lọc theo quyền.
- Thêm banner hỗ trợ kỹ thuật do quản trị viên cấu hình, chọn vị trí trên trang.
- Sửa kiểm tra nguồn đăng nhập khi truy cập qua proxy Home Assistant trên điện thoại.
- Giữ tài khoản xem cũ với phạm vi các dự án hiện có khi nâng cấp.

- Thiết kế lại trang đăng nhập với nền công nghệ, bố cục phù hợp máy tính/điện thoại.
- Dùng nguyên file logo Việt Phương; bỏ chữ Việt Phương ở góc đầu trang đăng nhập.
- Thêm chân trang đăng nhập và trang chính: bản quyền, sử dụng miễn phí, số điện thoại và link Facebook bấm được.
- Thêm nút hiện/ẩn mật khẩu và giữ thông báo lỗi đăng nhập rõ ràng.
- Kiểm tra giao diện trình duyệt trước khi phát hành image.

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
