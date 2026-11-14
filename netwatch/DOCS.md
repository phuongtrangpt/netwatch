# Cài và cấu hình

1. Thêm repository `https://github.com/phuongtrangpt/netwatch` vào kho add-on HAOS.
2. Cài **NetWatch Local** (chỉ sau khi workflow GitHub đã xanh và package GHCR là Public).
3. Vào Configuration:
   - `password`: mật khẩu riêng, tối thiểu 12 ký tự.
   - `ingest_url`: `http://IP_LAN_MAY_CHU:8080`, hoặc địa chỉ VPN mà router truy cập được.
4. Nếu cổng 8080 bị chiếm, đổi cổng trong Network và sửa ingest_url theo cổng mới.
5. Bật Start on boot và Watchdog; Start rồi Open Web UI.
6. Đăng nhập, tạo/chọn dự án và tải bộ cài router từ chính web máy chủ.

RouterOS tối thiểu 7.17 trong nhánh 7.x. Router chủ động gửi dữ liệu về máy chủ, không cần
mở RouterOS API 8728. Router ở xa phải có đường tới máy chủ qua VPN. Không mở web/API này
trực tiếp ra Internet. HTTP ở ví dụ dành cho LAN/VPN tin cậy.

## KTV: bật fetch và scheduler trước khi cài collector

Trong WinBox → New Terminal, chạy:

```routeros
/system device-mode print
```

NetWatch cần `fetch: yes` để gửi dữ liệu và `scheduler: yes` để chạy định kỳ. Chế độ `home` có thể mặc định tắt cả hai; các chế độ khác có thể đã bật. Nếu cả hai đã là `yes`, bỏ qua thao tác bật quyền.

Nếu có giá trị `no`, KTV có mặt tại router chạy:

```routeros
/system device-mode update fetch=yes scheduler=yes
```

Chờ thông báo xác nhận, rồi trong thời gian đếm ngược (mặc định 5 phút), nhấn nhanh rồi thả nút RESET hoặc MODE trên router đang chạy. Không giữ lâu và không giữ RESET khi cấp nguồn. Một số thiết bị cũ chỉ xác nhận được bằng ngắt toàn bộ nguồn rồi cấp lại; nếu có cả adapter và PoE, ngắt cả hai.

**Router khởi động lại, mạng gián đoạn tạm thời.** Lệnh reboot thông thường không thay thế xác nhận vật lý. Sau khi kết nối lại, chạy lại lệnh kiểm tra để xác nhận cả hai quyền là `yes` rồi mới cài/chạy lại collector. Lệnh trên giữ nguyên chế độ device-mode hiện tại, chỉ bật hai quyền cần thiết.

Nếu hết thời gian hoặc quá số lần thử, làm theo thông báo Terminal; không gửi lặp lệnh khi đang chờ xác nhận. Nếu không có menu device-mode, kiểm tra tài liệu đúng phiên bản/model. Tham khảo [tài liệu MikroTik](https://manual.mikrotik.com/docs/system-information-and-utilities/device-mode/).

## Dữ liệu và cập nhật

Supervisor cấp `/data` riêng. Bật backup add-on trước mỗi lần Update. Không gỡ add-on
để cập nhật và không đổi slug/repository URL, vì ứng dụng có thể được nhận là bản khác.
Không dùng volume Docker thủ công cho container do Supervisor quản lý.

Mật khẩu khởi tạo được lưu dưới dạng hash. Đổi password trong Configuration sau lần
chạy đầu chưa tự thay mật khẩu đang lưu. Xem tài liệu bảo trì trong docs/DOCKER.md;
không xóa database để đặt lại mật khẩu.

Giao diện mở trực tiếp cổng 8080, chưa dùng Ingress. Dữ liệu web cũ chưa tự chuyển sang máy chủ.
Công cụ xuất/nhập cấu hình có trong scripts; cần thao tác riêng khi chuyển từ bản cloud.

## Chia sẻ quyền xem

Từ 1.0.2, chủ web đăng nhập `admin` với mật khẩu hiện có, vào Cấu hình giám sát →
Tài khoản chỉ xem. Bật và đặt tên/mật khẩu riêng để chia sẻ. Tài khoản này đọc được
mọi dự án, không chỉnh sửa, không nhận bộ cài router. Có thể tắt/đổi mật khẩu trên
web để thu hồi phiên xem. Không phải sửa Configuration của add-on để tạo viewer.

## Tên hiển thị quản trị viên (1.0.7)

Trong **Cấu hình giám sát → Hồ sơ quản trị viên**, nhập tên sẽ hiển thị ở thanh bên. Thiết lập được lưu riêng trong dữ liệu của bản cài. Tên đăng nhập `admin` và mật khẩu không thay đổi.

## Kiểm tra WAN và cảnh báo Telegram (1.0.6)

1. Trong **Cấu hình giám sát → Chọn interface cho từng đường WAN**, bật chọn thủ công, chọn mỗi interface đại diện cho một line rồi lưu. Với PPPoE, chọn interface PPPoE client. Chỉ dự án có ít nhất hai line được chọn mới ping kiểm tra từng line.
2. Router ping `8.8.8.8` hai lần qua interface đã chọn mỗi chu kỳ thu thập. Sau hai chu kỳ liên tiếp không nhận phản hồi, NetWatch báo line mất Internet; khi ping thành công trở lại, ghi nhận phục hồi. Việc này không thay đổi PCC, route table, NAT hay firewall.
3. Tại dự án **Mạng chính**, cấu hình bot dùng chung và Chat ID Telegram cá nhân của Admin. Chat cá nhân nhận cảnh báo tổng từ mọi dự án. Bot Token được mã hóa trong `/data`.
4. Mở cấu hình Telegram của từng dự án, bật nhóm riêng và điền Chat ID nhóm. Thêm bot vào nhóm, cấp quyền gửi tin nhắn rồi bấm gửi thử. Mỗi nhóm chỉ nhận sự cố của đúng dự án đó.
5. Khi thêm hoặc sửa IP trong sơ đồ, bật ping và tích **Thông báo Telegram khi thiết bị gặp sự cố**. Chọn chỉ gửi một lần, lặp mỗi 30 phút hoặc mỗi giờ. Cảnh báo bắt đầu sau hai chu kỳ ping thất bại liên tiếp; khi thiết bị phục hồi sẽ gửi một tin khôi phục. Thiết bị không tích chọn sẽ không gửi cảnh báo Telegram.
6. Bản tin tổng hợp mặc định gửi lúc 08:00 giờ Việt Nam đến Chat ID Admin. Bản tin liệt kê tình trạng các router/dự án, thiết bị và line đang lỗi, cùng các sự cố trong 24 giờ trước. Có thể đổi giờ hoặc tắt trong cấu hình Mạng chính.
7. Nhắn `/start` cho bot cá nhân; thêm bot vào nhóm trước khi gửi thử. Cấu hình từ 1.0.5 được giữ và có thể dùng làm kênh Admin khi lưu thiết lập mới. Chat ID nhóm phải nhập riêng.
8. Router đang dùng collector cũ cần nâng cấp một lần: tải `netwatch-upgrade-v5.rsc` từ **Kết nối router**, đưa file vào WinBox → Files, sau đó chạy `/import file-name=netwatch-upgrade-v5.rsc`. Lệnh giữ nguyên khóa cũ và chỉ thay script NetWatch. Router mới tải bộ cài v5.

## Khóa sơ đồ và cảnh báo WAN (1.0.11)

Sơ đồ mặc định ở chế độ khóa. Bấm **Chỉnh sơ đồ** để thêm/xóa/sửa thiết bị, đổi vị trí, ghim, bật/tắt ping, tự sắp xếp hoặc chỉnh dây. Bấm **Xong chỉnh sơ đồ** để khóa lại. Khi khóa vẫn xem chi tiết, di chuyển khung nhìn, phóng to và toàn màn hình. Chuyển dự án hoặc mở lại trang sẽ khóa lại.

NetWatch phân biệt **Link** (interface mất/phục hồi kết nối) và **Internet** (ping riêng từng WAN). Link WAN được cảnh báo khi bản tin metrics xác nhận trạng thái đổi; WAN lấy từ cấu hình chọn thủ công hoặc thông tin WAN tự nhận diện. Chỉ interface được nhận diện là WAN mới gửi cảnh báo Link; không gửi cảnh báo WAN cho mọi cổng LAN.

Ping Internet riêng từng WAN vẫn cần chọn thủ công ít nhất hai interface và collector v5. Sau hai chu kỳ thất bại liên tiếp mới xác nhận mất Internet; gửi tin phục hồi sau khi ping thành công trở lại. Nếu collector cũ chưa gửi WAN probes, cập nhật collector bằng bản v5 giữ nguyên khóa tại Kết nối router.

Khi gửi cảnh báo lỗi, từng Chat ID có hàng đợi riêng trong dữ liệu ứng dụng. NetWatch ghi nhật ký gửi lỗi và thử lại từ 30 giây, giãn dần tối đa 5 phút, trong tối đa 24 giờ; hàng đợi còn sau khởi động lại. Tin thử gửi bằng nút Gửi thử không đưa vào hàng đợi.

Nếu cả router và máy chủ NetWatch mất toàn bộ Internet, Telegram không thể đến ngay: máy chủ cần kết nối trở lại để gửi, và các sự kiện chưa từng được router gửi tới máy chủ không thể suy ra chính xác. Hai loại cảnh báo Link và Internet có thể xuất hiện riêng vì phản ánh hai phép kiểm tra khác nhau.

## Nhắc lại sự cố WAN (1.0.12)

Chọn dự án → **Cấu hình giám sát → Nhắc lại Telegram khi WAN chưa phục hồi**. Chọn **Chỉ báo một lần**, **Mỗi 30 phút** hoặc **Mỗi 1 giờ**, rồi bấm **Lưu cấu hình**. Lựa chọn áp dụng cho các WAN trong dự án đó, gửi tới kênh tổng và nhóm dự án đã bật. Có thể dùng với một WAN khi theo dõi Link; kiểm tra Internet bằng ping riêng vẫn cần ít nhất hai WAN được chọn thủ công và collector v5.

Mốc nhắc lưu trong dữ liệu ứng dụng. Lần đầu ghi nhận WAN còn offline hoặc khi đổi chu kỳ sẽ bắt đầu đếm một khoảng đầy đủ. Các chu kỳ nhắc được kiểm tra khi nhận bản tin metrics/ping WAN mới, nên có thể chậm thêm một chu kỳ thu thập. Phục hồi hoặc bỏ chọn WAN sẽ dừng nhắc. Nếu dữ liệu cũ/router không gửi, không suy đoán WAN còn offline để nhắc.

## Phiên bản và nhánh PPPoE (1.0.13)

Số phiên bản đang chạy hiển thị trên thanh đầu trang, chân trang và trang đăng nhập, lấy từ gói ứng dụng đã cài. Khi cập nhật xong, nhấn Ctrl+F5 và đối chiếu số này.

Sơ đồ giữ nhánh WAN logic, loại cổng truyền dẫn PPPoE khỏi nhánh LAN (kể cả PPPoE qua VLAN). Không xóa interface, cấu hình WAN hoặc vị trí các thiết bị LAN đã ghim; việc ẩn đường chỉ tác động phần hiển thị sơ đồ.

## Quản trị viên và cập nhật trên web (1.0.17)

Trong **Cấu hình giám sát → Tài khoản quản trị**, đổi mật khẩu bằng mật khẩu hiện tại, mật khẩu mới và nhập lại. Mật khẩu dài 12–256 ký tự. Đổi thành công sẽ yêu cầu đăng nhập lại và thu hồi các phiên cũ của tài khoản đó; dữ liệu, khóa router và token Telegram không đổi.

Có thể tạo tối đa 20 quản trị viên bổ sung. Tài khoản quản trị có đầy đủ quyền trên mọi dự án và cài đặt, bao gồm quản lý tài khoản. Thêm/sửa/xóa quản trị viên yêu cầu xác nhận bằng mật khẩu của người đang đăng nhập. `admin` mặc định luôn được giữ; không tự xóa/tắt tài khoản đang sử dụng. Tài khoản Viewer vẫn giữ cơ chế phân quyền chỉ xem.

**Thông tin trang** hiển thị phiên bản đang cài, phiên bản phát hành mới nhất và môi trường chạy. Sau khi quản trị viên đăng nhập, ứng dụng kiểm tra GitHub; nếu có bản mới sẽ hiện popup. Chọn **Để sau** thì tiếp tục sử dụng, vẫn có thể kiểm tra/cập nhật trong mục này. Không tự cài khi chưa chọn đồng ý. Các tab mở lại trong cùng phiên không nhắc lặp cùng phiên bản.

### Windows portable

Cần cập nhật thủ công một lần lên gói đầy đủ 1.0.17 hoặc mới hơn để có trình cập nhật. Từ đó chọn **Cập nhật ngay** trên web. Gói chỉ được lấy từ bản phát hành chính thức `phuongtrangpt/netwatch`, kiểm tra kích thước và SHA-256. Chương trình chuẩn bị xong gói mới rồi dừng server, sao lưu file ứng dụng và toàn bộ dữ liệu (trừ thư mục cập nhật), thay file, khởi động và kiểm tra phiên bản. Lỗi khởi động sẽ khôi phục ứng dụng và dữ liệu trước cập nhật.

Không tắt máy khi đang cập nhật. Sau cập nhật qua web, ứng dụng chạy nền; để dừng, kết thúc đúng tiến trình node.exe của NetWatch trong Task Manager. Bản sao lưu và log của từng lần cập nhật ở `data/updates/<mã lần cập nhật>/`; không chia sẻ thư mục này vì có dữ liệu riêng. Cổng và biến môi trường của server được kế thừa. Nếu thư mục cài không có quyền ghi, cập nhật sẽ dừng và báo lỗi.

### Home Assistant OS và Docker

Home Assistant không cho một add-on cập nhật chính nó. NetWatch kiểm tra/báo phiên bản mới, nhưng người dùng cập nhật ở **Cài đặt → Ứng dụng/Tiện ích bổ sung → NetWatch Local → Cập nhật** và nên tạo backup trước. Nếu kho chưa thấy bản mới, làm mới kho ứng dụng trước. Không cần gỡ add-on.

Docker: tải image mới, tạo lại container theo cách đã cài và giữ nguyên volume dữ liệu. NetWatch không yêu cầu Docker socket hoặc quyền quản trị Home Assistant chỉ để tự thay container.
