# Cài và cấu hình

1. Thêm repository `https://github.com/phuongtrangpt/netwatch` vào kho add-on HAOS.
2. Cài **NetWatch Local** (chỉ sau khi workflow GitHub đã xanh và package GHCR là Public).
3. Vào Configuration:
   - `password`: mật khẩu riêng, tối thiểu 12 ký tự.
   - `ingest_url`: `http://IP_LAN_CUA_PI:8080`, hoặc địa chỉ VPN mà router truy cập được.
4. Nếu cổng 8080 bị chiếm, đổi cổng trong Network và sửa ingest_url theo cổng mới.
5. Bật Start on boot và Watchdog; Start rồi Open Web UI.
6. Đăng nhập, tạo/chọn dự án và tải bộ cài router từ chính web Pi.

RouterOS tối thiểu 7.17 trong nhánh 7.x. Router chủ động gửi dữ liệu về Pi, không cần
mở RouterOS API 8728. Router ở xa phải có đường tới Pi qua VPN. Không mở web/API này
trực tiếp ra Internet. HTTP ở ví dụ dành cho LAN/VPN tin cậy.

## Dữ liệu và cập nhật

Supervisor cấp `/data` riêng. Bật backup add-on trước mỗi lần Update. Không gỡ add-on
để cập nhật và không đổi slug/repository URL, vì ứng dụng có thể được nhận là bản khác.
Không dùng volume Docker thủ công cho container do Supervisor quản lý.

Mật khẩu khởi tạo được lưu dưới dạng hash. Đổi password trong Configuration sau lần
chạy đầu chưa tự thay mật khẩu đang lưu. Xem tài liệu bảo trì trong docs/DOCKER.md;
không xóa database để đặt lại mật khẩu.

Giao diện mở trực tiếp cổng 8080, chưa dùng Ingress. Dữ liệu web cũ chưa tự chuyển sang Pi.
Công cụ xuất/nhập cấu hình có trong scripts; cần thao tác riêng khi chuyển từ bản cloud.

## Chia sẻ quyền xem

Từ 1.0.3, đăng nhập `admin`, vào **Cấu hình giám sát → Tài khoản chỉ xem →
Thêm tài khoản**. Đặt tên, mật khẩu ít nhất 12 ký tự và tích dự án và từng mục giám sát được phép xem.
Có thể tạo nhiều tài khoản cho các chủ nhà; mỗi người chỉ thấy các dự án đã chọn,
không chỉnh sửa hoặc nhận bộ cài/khóa router. API cũng kiểm tra phạm vi dự án.

Dự án mới không tự chia sẻ. Sửa quyền, đổi mật khẩu, tắt hoặc xóa tài khoản sẽ
thu hồi phiên của riêng tài khoản đó. Để trống mật khẩu khi sửa để giữ mật khẩu cũ.
Quản trị viên cũng có thể cấu hình banner liên hệ kỹ thuật trong trang **Cấu hình giám sát**. Không cần sửa Configuration của add-on. Tài khoản xem cũ giữ quyền trên những dự án
đang có tại lần nâng cấp đầu tiên; hãy sửa quyền trước khi chia sẻ cho người khác.
