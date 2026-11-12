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
