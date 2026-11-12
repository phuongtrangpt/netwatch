# NetWatch · Giám sát MikroTik

Chạy trên Raspberry Pi với Home Assistant OS, không cần thuê cloud.
Sơ đồ mạng kéo thả, ghim/alias, switch ảo, chỉnh neo/đường dây, nhiều dự án RB5009/E50UG,
DHCP/PPPoE và lịch sử lưu cục bộ trong `/data`.

[Thêm kho NetWatch vào Home Assistant](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fphuongtrangpt%2Fnetwatch)

## Cài online trên HAOS

1. Chờ workflow trong tab **Actions** hoàn tất thành công.
2. Chỉ ở lần đầu, chủ kho mở package **netwatch** trên GitHub → Package settings →
   Change visibility → **Public**. Repository public không tự làm package GHCR public.
3. Home Assistant → Settings → Apps/Add-ons → Store → ⋮ → Repositories.
4. Thêm `https://github.com/phuongtrangpt/netwatch`.
5. Tìm **NetWatch Local**, chọn Install. Điền password và ingest_url, Start, Open Web UI.

[Hướng dẫn cấu hình](netwatch/DOCS.md). Nếu chưa thấy image hoặc ghcr.io trả Unauthorized,
kiểm tra workflow và trạng thái Public của package trước; chưa cần thay cấu hình router.

## Cập nhật sau này

- Sửa mã và chạy `npm run build`, `npm test`.
- Tăng cùng một phiên bản (ví dụ 1.0.1) ở `package.json`, `package-lock.json` và
  `netwatch/config.yaml`; thêm nội dung vào `netwatch/CHANGELOG.md`.
- Đẩy thay đổi lên `main`. Workflow tự kiểm tra và build/push image mang số phiên bản mới.
- Đợi Actions xanh, Home Assistant kiểm tra cập nhật kho. Backup NetWatch rồi chọn Update.
- Dữ liệu riêng trong `/data` được giữ lại. Không gỡ/cài lại add-on để cập nhật.

Nếu sửa mã mà chưa tăng phiên bản, workflow chỉ kiểm tra, không đẩy đè image phiên bản cũ.
Có thể chạy thủ công qua Actions → Kiểm tra và phát hành NetWatch → Run workflow trên main
để thử lại bản phát hành thất bại. Tag `v1.0.0` cũng được hỗ trợ, phải khớp phiên bản mã.

Không cần Docker Hub hoặc token cá nhân cho workflow: GHCR dùng GITHUB_TOKEN với quyền
packages:write. Không commit `.env`, database, khóa router hoặc dữ liệu xuất từ web cũ.

## Kiến trúc và kiểm tra

Image: `ghcr.io/phuongtrangpt/netwatch:1.0.2`, gồm `linux/arm64` và `linux/arm/v7`.
HAOS Pi hiện hành thường dùng aarch64; ARMv7 dành cho hệ ARM32 cũ còn tương thích.
Dockerfile mặc định `node:20-alpine` theo yêu cầu ban đầu. Node 20 đã EOL; có thể đổi
NODE_IMAGE sang LTS còn hỗ trợ sau khi kiểm tra manifest và tương thích hai kiến trúc.

CI chạy kiểm tra mã và khởi động thử hai image bằng QEMU; thử trên Pi thật vẫn cần thiết.
Đây là bản ứng dụng độc lập, không tự đồng bộ dữ liệu với web NetWatch trên cloud.

[Docker, backup và chuyển dữ liệu](docs/DOCKER.md)

## Tài khoản chỉ xem (từ 1.0.2)

- Quản trị đăng nhập tên **admin**, dùng mật khẩu quản trị đã đặt trước đây. Phiên
  quản trị đang dùng và database cũ vẫn được giữ khi cập nhật.
- Trong **Cấu hình giám sát → Tài khoản chỉ xem**, bật tài khoản, đặt tên (mặc định
  `view`) và mật khẩu riêng ít nhất 12 ký tự rồi Lưu tài khoản.
- Người xem mở cùng địa chỉ web, nhập tên/mật khẩu này. Xem được tất cả dự án,
  biểu đồ, WAN/LAN/VLAN, thiết bị, PPPoE, nhật ký và sơ đồ; vẫn tìm kiếm, chọn dự án,
  phóng to và toàn màn hình. Không thêm/sửa/xóa, kéo thiết bị, lưu cấu hình,
  thay dây hoặc tải bộ cài/khóa router. API cũng kiểm tra quyền, không chỉ ẩn nút.
- Đổi tên/mật khẩu hoặc tắt tài khoản sẽ thu hồi các phiên xem đang có. Để trống
  mật khẩu khi lưu nếu muốn giữ mật khẩu hiện tại.
- Cấu hình tài khoản xem lưu trong `/data/viewer.json` dưới dạng hash mật khẩu;
  được giữ cùng volume/backup, không commit file này lên GitHub.
