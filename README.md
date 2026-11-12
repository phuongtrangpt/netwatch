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

## Nhiều tài khoản chỉ xem và phân quyền dự án (1.0.3)

- Đăng nhập **admin**, vào **Cấu hình giám sát → Tài khoản chỉ xem → Thêm tài khoản**.
- Đặt tên đăng nhập, mật khẩu riêng ít nhất 12 ký tự và tích các dự án muốn chia sẻ.
- Mỗi người xem đăng nhập cùng địa chỉ web; chỉ thấy danh sách và dữ liệu của những
  dự án được cấp. Xem đầy đủ các mục, tìm kiếm, phóng to sơ đồ và toàn màn hình;
  không thêm/sửa/xóa, kéo thiết bị, đổi dây, lưu cấu hình hoặc nhận khóa/bộ cài router.
- API kiểm tra quyền trên từng dự án, kể cả khi tự sửa URL. Dự án mới tạo không tự
  cấp cho tài khoản xem; quản trị viên phải chọn thêm.
- Có thể sửa quyền, đổi mật khẩu, tắt hoặc xóa từng tài khoản. Mọi phiên của tài khoản
  vừa thay đổi hết hiệu lực; các tài khoản khác vẫn hoạt động. Khi sửa, để trống mật
  khẩu để giữ mật khẩu hiện tại.
- Tài khoản xem cũ từ 1.0.2 giữ mật khẩu và quyền trên các dự án hiện có tại lần
  nâng cấp đầu tiên. Hãy mở **Sửa quyền** để giới hạn trước khi chia sẻ cho chủ nhà.
- Dữ liệu quản trị, dự án và sơ đồ cũ được giữ. Danh sách tài khoản và hash mật khẩu
  nằm trong `/data/viewer.json`, được giữ cùng volume/backup; không commit file này.

## Giao diện và hỗ trợ kỹ thuật (1.0.3)

Trang đăng nhập dùng logo gốc và nền công nghệ nhẹ, hỗ trợ điện thoại. Cả trang đăng nhập
và dashboard có liên hệ bấm được: 0963839369, https://www.facebook.com/leviethoaiphuong/,
bản quyền Việt Phương và thông báo sử dụng miễn phí. Quản trị viên có thể bật banner hỗ trợ, nhập tên/số kỹ thuật viên và chọn vị trí hiển thị. Logo được phục vụ trước đăng nhập;
các API giám sát vẫn yêu cầu tài khoản và kiểm tra quyền như trước.
