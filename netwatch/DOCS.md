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

## Kiểm tra WAN và cảnh báo Telegram (1.0.6)

1. Trong **Cấu hình giám sát → Chọn interface cho từng đường WAN**, bật chọn thủ công, chọn mỗi interface đại diện cho một line rồi lưu. Với PPPoE, chọn interface PPPoE client. Chỉ dự án có ít nhất hai line được chọn mới ping kiểm tra từng line.
2. Router ping `8.8.8.8` hai lần qua interface đã chọn mỗi chu kỳ thu thập. Sau hai chu kỳ liên tiếp không nhận phản hồi, NetWatch báo line mất Internet; khi ping thành công trở lại, ghi nhận phục hồi. Việc này không thay đổi PCC, route table, NAT hay firewall.
3. Tại dự án **Mạng chính**, cấu hình bot dùng chung và Chat ID Telegram cá nhân của Admin. Chat cá nhân nhận cảnh báo tổng từ mọi dự án. Bot Token được mã hóa trong `/data`.
4. Mở cấu hình Telegram của từng dự án, bật nhóm riêng và điền Chat ID nhóm. Thêm bot vào nhóm, cấp quyền gửi tin nhắn rồi bấm gửi thử. Mỗi nhóm chỉ nhận sự cố của đúng dự án đó.
5. Khi thêm hoặc sửa IP trong sơ đồ, bật ping và tích **Thông báo Telegram khi thiết bị gặp sự cố**. Chọn chỉ gửi một lần, lặp mỗi 30 phút hoặc mỗi giờ. Cảnh báo bắt đầu sau hai chu kỳ ping thất bại liên tiếp; khi thiết bị phục hồi sẽ gửi một tin khôi phục. Thiết bị không tích chọn sẽ không gửi cảnh báo Telegram.
6. Bản tin tổng hợp mặc định gửi lúc 08:00 giờ Việt Nam đến Chat ID Admin. Bản tin liệt kê tình trạng các router/dự án, thiết bị và line đang lỗi, cùng các sự cố trong 24 giờ trước. Có thể đổi giờ hoặc tắt trong cấu hình Mạng chính.
7. Nhắn `/start` cho bot cá nhân; thêm bot vào nhóm trước khi gửi thử. Cấu hình từ 1.0.5 được giữ và có thể dùng làm kênh Admin khi lưu thiết lập mới. Chat ID nhóm phải nhập riêng.
8. Router đang dùng collector cũ cần nâng cấp một lần: tải `netwatch-upgrade-v5.rsc` từ **Kết nối router**, đưa file vào WinBox → Files, sau đó chạy `/import file-name=netwatch-upgrade-v5.rsc`. Lệnh giữ nguyên khóa cũ và chỉ thay script NetWatch. Router mới tải bộ cài v5.
