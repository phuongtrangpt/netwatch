# 1.0.15

- Không vẽ nhánh cổng rỗng trên sơ đồ: loại các đoạn ether1/ether2 bị thừa khi PPPoE chưa có ánh xạ cổng vật lý.
- Giữ nguyên hai nhánh WAN, nhánh LAN có thiết bị phía sau và vị trí biểu tượng đã lưu. Chỉ thay đổi hiển thị sơ đồ, không đổi cấu hình router.

# 1.0.14

- Thống nhất tiêu đề Telegram có tên dự án cho cảnh báo WAN/thiết bị/router, tin phục hồi và nhắc lại.
- Lấy tên từ dự án đã lưu thay vì bảng router không có trường tên; áp dụng cho cả kênh tổng, nhóm và tin gửi lại từ hàng đợi.

# 1.0.13

- Bỏ nhánh cổng vật lý dùng làm đường truyền PPPoE khỏi phần nhánh LAN, hỗ trợ cả PPPoE qua VLAN và khi danh sách WAN chưa đồng bộ.
- Hiển thị phiên bản gói đang chạy trên thanh đầu trang, chân trang và trang đăng nhập; dùng số phiên bản từ gói ứng dụng.

# 1.0.12

- Thêm tùy chọn nhắc WAN một lần, mỗi 30 phút hoặc mỗi giờ tại Cấu hình giám sát; cấu hình riêng theo dự án.
- Nhắc cho WAN còn mất Link/Internet khi dữ liệu mới xác nhận sự cố; tự dừng khi phục hồi hoặc bỏ WAN khỏi danh sách. Không gửi nhắc dựa trên dữ liệu đã cũ.
- Lưu mốc nhắc để không mất chu kỳ sau khi khởi động lại. Mặc định giữ chế độ một lần cho các cài đặt cũ.

# 1.0.11

- Sơ đồ mặc định khóa: chỉ bật kéo thả, thêm/xóa/sửa thiết bị, ghim, ping, tự sắp xếp và chỉnh dây sau khi bấm Chỉnh sơ đồ. Xong chỉnh sơ đồ khóa lại; đổi dự án cũng khóa lại.
- Gửi cảnh báo Telegram khi interface WAN mất/phục hồi Link, kể cả một WAN hoặc collector chưa gửi ping WAN; các sự kiện cổng LAN không gửi dưới dạng WAN.
- Sửa xác nhận ping Internet: chỉ báo mất sau hai lần thất bại liên tiếp, không báo phục hồi ở lần thất bại đầu và không lặp cảnh báo mất khi WAN vẫn offline.
- Lưu hàng đợi Telegram riêng từng Chat ID, thử lại khi gửi lỗi và sau khởi động lại, tối đa 24 giờ; ghi nhận gửi lỗi trong nhật ký.

# 1.0.10

- Thống nhất giao diện và hướng dẫn cho MikroTik và máy chủ NetWatch; model chỉ xuất hiện trong phần chọn thiết bị khi thêm/sửa dự án.
- Thêm hướng dẫn kiểm tra fetch/scheduler, bật trong device-mode và xác nhận vật lý trước khi cài collector.
- Mở rộng lựa chọn model và tách lựa chọn model khỏi mục đích giám sát.

# 1.0.9

- Sửa trang trắng sau đăng nhập trên Windows: phục vụ JavaScript/CSS đúng với dấu phân cách đường dẫn của hệ điều hành.
- Kiểm tra gói Windows bằng đăng nhập thật và tải các tài nguyên giao diện sau đăng nhập.
- Bổ sung hướng dẫn cập nhật Windows giữ nguyên dữ liệu.

# 1.0.7

- Thêm tên hiển thị quản trị viên có thể chỉnh sửa riêng cho từng bản cài; không đổi tài khoản đăng nhập hoặc mật khẩu.

# 1.0.6

- Thêm bật/tắt cảnh báo Telegram cho từng IP được thêm vào sơ đồ; chọn gửi một lần, nhắc mỗi 30 phút hoặc mỗi giờ khi chưa phục hồi.
- Xác nhận thiết bị offline sau hai chu kỳ ping thất bại liên tiếp; gửi tin phục hồi khi ping thông trở lại.
- Dùng một bot chung: Admin nhận cảnh báo tổng mọi dự án; mỗi dự án có thể gửi bản tin riêng vào nhóm Telegram của chính dự án đó.
- Gửi bản tin tổng hợp hằng ngày cho Admin, gồm trạng thái dự án và sự cố trong 24 giờ; mặc định 08:00 giờ Việt Nam, có thể đổi giờ hoặc tắt.
- Giữ cấu hình Telegram 1.0.5 hoạt động cho tới khi Admin lưu cấu hình bot dùng chung mới.

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

- Đóng gói NetWatch cho HAOS và máy chủ.
- Lưu dữ liệu SQLite cục bộ trong /data.
- Giữ sơ đồ thủ công, neo, điểm uốn, switch ảo và nhiều dự án.
- GitHub Actions build image ARM64/ARMv7 và kiểm tra khởi động qua QEMU.
