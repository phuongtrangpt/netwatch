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

Từ 1.0.2, chủ web đăng nhập `admin` với mật khẩu hiện có, vào Cấu hình giám sát →
Tài khoản chỉ xem. Bật và đặt tên/mật khẩu riêng để chia sẻ. Tài khoản này đọc được
mọi dự án, không chỉnh sửa, không nhận bộ cài router. Có thể tắt/đổi mật khẩu trên
web để thu hồi phiên xem. Không phải sửa Configuration của add-on để tạo viewer.

## Kiểm tra line WAN và Telegram (1.0.5)

1. Trong **Cấu hình giám sát → Chọn interface cho từng đường WAN**, bật chọn thủ công, chọn mỗi interface đại diện cho một line rồi lưu. Với PPPoE, chọn interface PPPoE client. Chỉ dự án có ít nhất hai line được chọn mới ping kiểm tra từng line.
2. Router ping `8.8.8.8` hai lần qua interface đã chọn mỗi chu kỳ thu thập. Sau hai chu kỳ liên tiếp không nhận phản hồi, NetWatch báo line mất Internet; khi ping thành công trở lại, ghi nhận phục hồi. Việc này không thay đổi PCC, route table, NAT hay firewall.
3. Ở **Cảnh báo sự cố qua Telegram**, tạo bot bằng `@BotFather`, nhắn `/start` với bot, điền Bot Token và Chat ID rồi lưu. Bấm **Gửi tin nhắn thử** để xác nhận. Mỗi dự án có cấu hình độc lập.
4. Telegram nhận cảnh báo khi WAN chuyển offline/online, hoặc router ngừng gửi dữ liệu quá 3 phút và sau đó gửi lại. Bot Token được mã hóa trước khi lưu trong `/data` và chỉ Admin được thao tác.
5. Router đang dùng collector cũ cần nâng cấp một lần: tải `netwatch-upgrade-v5.rsc` từ **Kết nối router**, đưa file vào WinBox → Files, sau đó chạy `/import file-name=netwatch-upgrade-v5.rsc`. Lệnh giữ nguyên khóa cũ và chỉ thay script NetWatch. Router mới tải bộ cài v5.
