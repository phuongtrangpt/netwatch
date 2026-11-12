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

Image: `ghcr.io/phuongtrangpt/netwatch:1.0.3`, gồm `linux/arm64` và `linux/arm/v7`.
HAOS Pi hiện hành thường dùng aarch64; ARMv7 dành cho hệ ARM32 cũ còn tương thích.
Dockerfile mặc định `node:20-alpine` theo yêu cầu ban đầu. Node 20 đã EOL; có thể đổi
NODE_IMAGE sang LTS còn hỗ trợ sau khi kiểm tra manifest và tương thích hai kiến trúc.

CI chạy kiểm tra mã và khởi động thử hai image bằng QEMU; thử trên Pi thật vẫn cần thiết.
Đây là bản ứng dụng độc lập, không tự đồng bộ dữ liệu với web NetWatch trên cloud.

[Docker, backup và chuyển dữ liệu](docs/DOCKER.md)

## Phân quyền Viewer và banner hỗ trợ (từ 1.0.3)

- Admin mở **Cấu hình giám sát → Quản lý tài khoản xem** để tạo nhiều Viewer. Mỗi tài khoản chọn dự án và từng mục được phép xem (Tổng quan, Sơ đồ mạng, WAN, LAN, Thiết bị, Cổng, Định tuyến, PPPoE, Sự kiện).
- Các dự án và mục không được cấp quyền bị ẩn trên giao diện **và bị chặn ở API**. Viewer không tạo khóa router, thay đổi sơ đồ hoặc chỉnh cấu hình.
- Admin mở **Cấu hình giám sát → Banner hỗ trợ kỹ thuật** để chỉnh tên KTV, số điện thoại, Facebook, nội dung, vị trí trên/dưới và hiển thị cho mọi người hoặc chỉ Viewer.
- Trang đăng nhập responsive có thông tin sử dụng miễn phí, số điện thoại và link Facebook hỗ trợ.
- Đăng nhập qua HTTPS reverse proxy được hỗ trợ thông qua Fetch Metadata của trình duyệt; với proxy đặc biệt có thể cấu hình `NETWATCH_PUBLIC_URL`, hoặc `NETWATCH_ALLOWED_ORIGINS` là danh sách origin được phép, cách nhau dấu phẩy. Chỉ bật `NETWATCH_TRUST_PROXY=true` nếu máy chủ đứng sau proxy đáng tin cậy đã ghi đè các header `X-Forwarded-Host` và `X-Forwarded-Proto`.
- Nâng cấp giữ dữ liệu cũ trong `/data`. Tài khoản Viewer cũ vẫn hoạt động và ban đầu giữ quyền xem mọi dự án, mọi mục cho tương thích; hãy vào Admin chỉnh lại phạm vi trước khi chia sẻ.
- Trước khi cập nhật Add-on, tạo bản backup dữ liệu. Không chia sẻ `/data` hoặc token thu thập router.

