export const DISCLAIMER_UPDATED='15/11/2026';
export const DISCLAIMER_SUMMARY="NetWatch là phần mềm cộng đồng, được cung cấp theo hiện trạng và có thể có lỗi. Hãy sao lưu, thử nghiệm trước khi dùng trên mạng đang hoạt động; việc thu thập dữ liệu và ping có thể ảnh hưởng hiệu năng hoặc độ ổn định trong một số môi trường.";
export const DISCLAIMER_SECTIONS=[
  {
    "title": "1. Phạm vi và tính chất phần mềm",
    "paragraphs": [
      "NetWatch là công cụ hỗ trợ giám sát mạng do cộng đồng sử dụng và đóng góp. Phần mềm được cung cấp theo hiện trạng, tùy khả năng sẵn có; không có cam kết hoạt động liên tục, không có lỗi, tương thích với mọi thiết bị/phiên bản RouterOS hoặc phù hợp cho mọi mục đích. Hỗ trợ cộng đồng không kèm cam kết thời gian phản hồi hay khắc phục sự cố."
    ]
  },
  {
    "title": "2. Rủi ro khi vận hành",
    "paragraphs": [
      "Script trên router, các phép ping, truy vấn thông số, gửi dữ liệu, kết nối dịch vụ ngoài và cập nhật phần mềm có thể phát sinh tải, lưu lượng, lỗi tương thích hoặc tác động gián tiếp đến độ ổn định của thiết bị và mạng. Không thể bảo đảm rằng thao tác giám sát hoàn toàn không ảnh hưởng kết nối WAN/PPPoE.",
      "Thông tin trên trang, nhật ký và cảnh báo Telegram có thể trễ, thiếu hoặc không chính xác khi mất kết nối, dữ liệu cũ, cấu hình chưa phù hợp hoặc dịch vụ bên ngoài lỗi. Không dùng NetWatch làm nguồn cảnh báo duy nhất cho hệ thống quan trọng."
    ]
  },
  {
    "title": "3. Việc người triển khai cần thực hiện",
    "paragraphs": [
      "Chỉ triển khai trên thiết bị/mạng mà bạn được phép quản trị. Đọc và hiểu script trước khi import; sao lưu cấu hình router và dữ liệu NetWatch, kiểm tra khả năng phục hồi, thử nghiệm trong môi trường phù hợp và bố trí thời gian bảo trì trước khi cài đặt hoặc nâng cấp.",
      "Theo dõi tài nguyên và kết nối sau khi bật giám sát; giảm tần suất hoặc tạm dừng bộ thu thập nếu xuất hiện bất thường. Chuẩn bị phương án truy cập và phục hồi độc lập với NetWatch. Tắt lịch netwatch-upload chỉ ngừng các lượt chạy mới; lượt script đang chạy có thể cần thêm thời gian để kết thúc."
    ]
  },
  {
    "title": "4. Dữ liệu, khóa kết nối và dịch vụ bên ngoài",
    "paragraphs": [
      "Người vận hành cần bảo vệ tài khoản quản trị, thư mục dữ liệu, bản sao lưu, khóa kết nối và token Telegram; không chia sẻ file cài đặt hoặc log có chứa thông tin bí mật. Tự kiểm tra quyền truy cập, cấu hình công khai máy chủ và việc truyền thông tin mạng tới Telegram hoặc dịch vụ khác. GitHub, Telegram, nhà mạng và các dịch vụ ngoài có thể gián đoạn hoặc thay đổi mà dự án không kiểm soát được."
    ]
  },
  {
    "title": "5. Giới hạn trách nhiệm và quyền theo pháp luật",
    "paragraphs": [
      "Trong phạm vi pháp luật áp dụng cho phép, tác giả và người đóng góp không cung cấp bảo đảm về phần mềm và không chịu trách nhiệm đối với thiệt hại phát sinh từ việc sử dụng, không sử dụng được hoặc triển khai/cấu hình phần mềm, bao gồm gián đoạn kết nối, mất dữ liệu, doanh thu hay chi phí khôi phục.",
      "Nội dung này không loại trừ hoặc hạn chế các quyền của người sử dụng và trách nhiệm mà pháp luật bắt buộc áp dụng, cũng không thay thế thỏa thuận riêng hợp pháp giữa các bên. Đây là thông báo về điều kiện và rủi ro sử dụng, không phải cam kết đã loại bỏ mọi trách nhiệm pháp lý."
    ]
  }
];
