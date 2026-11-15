# NEC UNIVERGE IX2106 · SNMP thử nghiệm

NetWatch dùng chung ứng dụng và dữ liệu với MikroTik. Khi thêm dự án, chọn **Hãng thiết bị → NEC**, **Model → IX2106**. Dự án cũ tự giữ hãng MikroTik; không đổi hãng của một dự án đã tạo.

Thiết bị mục tiêu: IX2106 firmware **10.5.13** theo ảnh do người dùng cung cấp. Bản tích hợp đã kiểm thử bằng SNMP agent mô phỏng qua UDP; **chưa xác nhận trên IX2106 thật**. Không yêu cầu nâng cấp firmware router chỉ để thử NetWatch.

## Kết nối

1. Đặt máy chủ NetWatch trong LAN hoặc VPN có thể truy cập IPv4 quản trị của NEC.
2. Nhờ KTV bật **SNMP v2c**, tạo community riêng có quyền **chỉ đọc (ro)**; giới hạn ACL nguồn là IP máy chủ NetWatch. Đối chiếu cú pháp với tài liệu NEC đúng firmware, không dán lệnh RouterOS vào NEC.
3. Trong dự án NEC, mở **Kết nối router**, nhập IPv4, cổng UDP (mặc định 161) và community. Chọn **Bật thu thập SNMP → Lưu kết nối → Kiểm tra SNMP**.
4. Chờ dữ liệu interface xuất hiện. Vào **Cấu hình giám sát**, chọn WAN thủ công theo cấu hình thực tế, ví dụ tên interface logic mà router trả về. Không mặc định coi GE0 hoặc GE1 là WAN.
5. Cần ít nhất hai mẫu để tính RX/TX. Chu kỳ tối thiểu 30 giây; nhiều dự án được đọc lần lượt để giới hạn tải. Mỗi lượt đọc giới hạn 15 giây, 512 interface và 20.000 varbind/bảng.

Không cần NAT khi máy chủ ở cùng LAN và ACL cho phép truy cập. Nếu khác mạng, ưu tiên VPN. Không công khai UDP SNMP trên Internet. Docker/Home Assistant phải có đường mạng tới NEC từ chính môi trường chạy ứng dụng.

## Phạm vi hiện tại

| Chức năng | Trạng thái |
| --- | --- |
| Tên và mô tả firmware | SNMP system |
| Uptime | sysUpTime: thời gian SNMP agent hoạt động, có thể khác uptime toàn router |
| Interface up/down và lưu lượng | IF-MIB; RX/TX cần Counter64 của ifXTable |
| Chọn WAN, đặt tên đường truyền | Thủ công trên web |
| Nhật ký và Telegram khi WAN đổi link | Có, sau khi chọn WAN; chưa xác minh Internet qua từng WAN |
| Sơ đồ, bố trí thủ công | Có |
| Ping IP, tự khám phá DHCP/ARP, LAN/VLAN, route, tài khoản PPPoE | Chưa hỗ trợ cho NEC |
| CPU, heap, nhiệt độ và từng cổng HUB vật lý | Chưa thu thập private MIB |
| SNMPv3 | Chưa hỗ trợ trong bộ thu thập hiện tại |

Dữ liệu chưa có hiển thị “—”, không suy diễn bằng 0. Link up không bảo đảm Internet hoạt động. Không dùng bộ đếm 32 bit để tính lưu lượng vì có thể quay vòng trong một chu kỳ trên đường gigabit. Nếu không có Counter64, vẫn có trạng thái interface nhưng không có tốc độ.

Community được mã hóa bằng khóa ứng dụng trong `data/auth.json`, không trả lại trình duyệt. SNMPv2c trên đường mạng không mã hóa, vì vậy dùng LAN/VPN tin cậy và ACL. Sao lưu cả thư mục `data` để giữ khóa giải mã. Bộ thu thập chỉ gọi GET/GETBULK, không gọi SET.

## Nếu chưa nhận dữ liệu

- Kiểm tra đúng IP/cổng, SNMP đã bật, community và ACL. Sai community thường chỉ gây timeout.
- Kiểm tra UDP từ máy chủ/container NetWatch tới router; ping thông chưa đủ chứng minh UDP SNMP thông.
- Kiểm tra quyền đọc system, ifTable và ifXTable. Xem thông báo tại **Kết nối router**.
- Khi lỗi SNMP, giữ dữ liệu cuối và hiển thị mất liên lạc; không tự coi tất cả WAN đã down.
- Để dừng: bỏ **Bật thu thập SNMP**, bấm **Lưu kết nối**. Không có script/scheduler NetWatch cần gỡ trên NEC.

Tài liệu tham khảo chính thức: [NEC SNMP FAQ](https://jpn.nec.com/univerge/ix/faq/snmpv1.html), [NEC manuals và MIB](https://jpn.nec.com/univerge/ix/Manual/index.html). NEC công bố IF-MIB chỉ triển khai một phần; theo dõi từng cổng của HUB tích hợp cần private MIB riêng.
