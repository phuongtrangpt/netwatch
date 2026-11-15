# Lịch sử trạng thái, RTT và bảo trì (1.0.27)

Trong **Tổng quan → Lịch sử trạng thái & sự cố**, chọn **24 giờ** hoặc **7 ngày**. Có tìm kiếm theo tên/loại, bảng cuộn và danh sách sự cố gần đây.

- **Dữ liệu router:** router còn gửi/đọc được dữ liệu hay không; ngừng quá 3 phút là mất dữ liệu, không khẳng định router hỏng.
- **Link WAN:** trạng thái interface đã chọn, không bảo đảm Internet thông.
- **Internet WAN:** kết quả ping 8.8.8.8 qua từng WAN; hiện cần chọn thủ công ít nhất hai WAN trên MikroTik. Xác nhận mất Internet sau hai chu kỳ thất bại, lỗi chạy phép kiểm tra là chưa xác định.
- **Ping thiết bị:** IP được bật theo dõi trong sơ đồ. Không phản hồi ICMP có thể do firewall/chính sách thiết bị.

## Ping bao nhiêu ms?

Sau khi cập nhật máy chủ, vào **Kết nối router → tải bản nâng cấp bộ thu thập v7 giữ nguyên khóa**. Upload `netwatch-upgrade-v7.rsc` trong WinBox Files, mở Terminal:

```routeros
/import file-name=netwatch-upgrade-v7.rsc
```

Bản nâng cấp chỉ đổi script/scheduler NetWatch, giữ địa chỉ và khóa gửi dữ liệu hiện tại. Script được parse trước khi thay thế; không thay WAN, LAN, route hay firewall. Chưa kiểm thử v7 trên router thật trong lần phát hành này; nên thử trên một dự án trước.

v7 lấy RTT trung bình từ **hai gói ping sẵn có**, không tăng số gói hoặc tần suất. Router gửi microsecond, web đổi thành millisecond; đó là độ trễ từ router đến IP đích, không phải từ trình duyệt hay máy chủ NetWatch. WAN là RTT đến 8.8.8.8 qua interface đã chọn. Timeout/lỗi/thiếu dữ liệu hiển thị “—”, không ghi thành 0 ms. Collector cũ vẫn nhận dữ liệu và tính lịch sử trạng thái nhưng chưa có RTT. NEC hiện chưa hỗ trợ ping IP/RTT.

## Uptime và gián đoạn

- Xanh: có quan sát kết nối; đỏ: có gián đoạn được ghi nhận trong ô thời gian; xám: chưa xác định/thiếu dữ liệu. Một ô không bảo đảm tất cả thời điểm trong ô đều có mẫu.
- **Uptime = thời gian online / (online + offline)**; thời gian chưa xác định không đưa vào mẫu số. Luôn xem kèm **độ phủ dữ liệu** để tránh hiểu 100% uptime là đã theo dõi đủ cả 7 ngày.
- Thời gian gián đoạn là khoảng được xác định offline; độ chính xác phụ thuộc chu kỳ và bước xác nhận, không phải phép đo liên tục.
- Ghi bắt đầu/kết thúc từng sự cố; nếu mất quan sát trong lúc đang offline thì đánh dấu ngừng xác định, không báo phục hồi giả.
- Lịch sử bắt đầu sau khi nâng cấp và có mẫu mới, không dựng lại dữ liệu 24 giờ/7 ngày trước đó. Lưu cục bộ tối đa 7 ngày và 50.000 đoạn trạng thái hoàn tất mỗi dự án (dọn định kỳ). Khi vượt giới hạn, phần không còn lịch sử là thiếu dữ liệu.

## Gom cảnh báo theo router

Khi router không gửi dữ liệu quá 3 phút, hệ thống báo mất dữ liệu router, các đối tượng phụ thuộc chuyển chưa xác định. Bỏ các cảnh báo thiết bị/WAN đang chờ khi chúng chỉ dựa vào dữ liệu cũ; khi router trở lại, bắt đầu xác nhận mới, không phát lại hàng loạt tin phục hồi cũ.

## Bảo trì có thời hạn

Quản trị viên bấm **Bảo trì**, chọn toàn dự án hoặc một IP đang theo dõi, thời hạn 30 phút/1 giờ/4 giờ/24 giờ và lý do tùy chọn. Có thể kết thúc sớm. Thời hạn được lưu tại máy chủ, tồn tại sau khởi động lại và tự hết hạn theo giờ máy chủ.

Thu thập và lịch sử vẫn chạy; tạm ngừng cảnh báo sự cố/phục hồi và lời nhắc thuộc phạm vi bảo trì. Hàng đợi cảnh báo liên quan được hủy. Bản tin tổng hợp hằng ngày vẫn hoạt động. Khi hết hạn, hệ thống tiếp tục cảnh báo và gửi thông báo nếu còn sự cố được xác định bằng dữ liệu mới, tôn trọng tùy chọn thông báo của thiết bị. Bảo trì không thay cấu hình router. Thống kê uptime vẫn bao gồm gián đoạn trong thời gian bảo trì.

Người xem được đọc lịch sử khi có quyền Tổng quan của dự án; lịch sử từng thiết bị cần thêm quyền Sơ đồ. Người xem không thể đặt/hủy bảo trì. Xóa dự án dọn cả lịch sử và bảo trì của dự án đó.
