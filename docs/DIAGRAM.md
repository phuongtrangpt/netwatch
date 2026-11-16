## Hiệu năng sơ đồ (v1.0.31)
Tính đường đi tránh chồng lấn chạy trong Web Worker. Trong lúc tính, sơ đồ hiển thị đường xem trước và vẫn thao tác được. Yêu cầu chỉnh góc liên tiếp được gộp trong 120 ms, công việc cũ bị hủy và không được ghi đè kết quả mới. Đổi nền hoặc cập nhật trạng thái không chạy lại bộ tìm đường nếu hình học không đổi. Trình duyệt không hỗ trợ Worker dùng đường xem trước nhẹ, vẫn giữ góc/neo đã lưu.

Dây vàng vẫn chuyển động nhưng giảm số lần vẽ, tạm dừng lúc kéo/phóng/di chuyển sơ đồ. Chỉ các phần tử trong vùng nhìn được dựng.

# Màu nền và dây vàng (1.0.30)

Trên thanh công cụ sơ đồ, mở **Nền sơ đồ** để chọn Đen, Trắng, Xám hoặc màu tùy chọn. Mặc định nền đen. Thẻ thiết bị, chữ, thước và đường canh tự chuyển theo nền sáng/tối để dễ đọc. Thay màu không di chuyển thiết bị, sửa góc/neo hoặc thay cấu hình router; người xem cũng có thể chọn màu.

Lựa chọn lưu riêng trong trình duyệt tại địa chỉ NetWatch đang dùng, dùng lại khi tải lại trang và áp dụng cho các dự án trong trình duyệt đó. Trình duyệt/địa chỉ khác có lựa chọn riêng. Xóa dữ liệu trang web sẽ đặt lại lựa chọn.

Dây đang có kết nối có màu vàng và chuyển động theo đường dây. Dây Offline/Chưa xác định đứng yên, vẫn có kiểu nét khác nhau. Trên nền trắng, viền đậm giúp nhận rõ dây vàng. Hệ điều hành đặt giảm chuyển động sẽ làm hiệu ứng đứng yên, vẫn giữ màu vàng.

# Sơ đồ tương phản cao, thước canh và góc dây (1.0.29)

## Dễ nhìn khi khó phân biệt màu

Nền trung tính, icon/chữ/viền đậm. Có chữ và ký hiệu trạng thái:

- Có kết nối: dấu kiểm, đường nét đứt chuyển động màu vàng (từ 1.0.30).
- Offline: dấu X, đường nét đứt dài màu nâu cam/orange tùy nền.
- Đang kiểm tra: dấu cảnh báo, kiểu nét dài/ngắn.
- Chưa xác định/dữ liệu cũ: dấu hỏi, nét chấm ngắn và viền đứt.

Không cần dựa vào màu đỏ/xanh lá để nhận biết trạng thái. Bấm **100%** để đọc rõ tên/IP hoặc **Vừa khung** để xem toàn cảnh. Thu nhỏ quá nhiều sẽ làm mọi chữ nhỏ theo sơ đồ.

## Thước và canh hàng

**Thước canh** bật mặc định, gồm thước ngang/dọc. Số đo là pixel trong tọa độ sơ đồ, thay đổi đúng khi pan/zoom. Có thể có tọa độ âm ở phần canvas bên ngoài gốc.

Bấm **Chỉnh sơ đồ**, bật **Hít lưới / canh hàng**:

- Kéo thiết bị hít theo bước 10 px.
- Khi gần cùng hàng/cột/cạnh/tâm với thiết bị khác, hiện đường canh nét đen.
- Khi thả, căn vào đường gần nhất trong phạm vi 6 pixel màn hình. Vị trí được lưu như thao tác kéo trước đây.
- Có thể tắt hít để kéo tự do. Kéo nhiều biểu tượng cùng lúc chỉ dùng hít lưới, không dùng hít theo thiết bị khác.

## Sửa góc dây

1. Bấm **Chỉnh sơ đồ**.
2. Bấm dây, hoặc chọn trong danh sách **Chọn đường dây để chỉnh góc**.
3. Các ô có số là góc chỉnh được. Kéo góc để đổi vị trí đường đi; đoạn kề được điều chỉnh để giữ vuông góc. Một góc gần đầu dây có thể chỉ dịch theo một trục để giữ đúng cạnh neo.
4. Nhấn đúp lên một đoạn dây để thêm điểm tại đoạn đó, hoặc dùng **Thêm điểm uốn**. Có thể nhập X/Y trong bảng. Tối đa 12 điểm chỉnh tay mỗi dây; hệ thống có thể thêm đoạn nối vuông góc giữa các điểm.
5. Có thể kéo neo A/B hoặc chọn cạnh/vị trí neo.
6. Bấm **Lưu đường dây**, rồi **Xong chỉnh sơ đồ**. Thoát mà chưa lưu thì thay đổi góc/neo chưa được lưu. Sau lưu, thay đổi tồn tại qua tải lại/khởi động lại.

**Tự động dây này** xóa góc và neo chỉnh tay của dây đang chọn. Các đường tự động có thể được tính lại để tránh đường đã chỉnh; vị trí thiết bị được giữ nguyên.

## Xử lý chồng lấn sau cập nhật

Bấm **Chỉnh sơ đồ → Gỡ rối dây**. Thao tác này xóa các điểm uốn chỉnh tay cũ của toàn sơ đồ và tính lại dây, giữ nguyên vị trí thiết bị và neo A/B đã đặt. Không dùng Tự sắp xếp nếu muốn giữ bố cục kéo tay.

Bộ đi dây ưu tiên tránh chồng đoạn, hạn chế giao cắt và thử lại thứ tự khi cần. Nếu thiết bị quá sát/đè nhau hoặc neo cố định gây ràng buộc, vẫn có thể còn giao cắt. Dây đó có cảnh báo; hãy chọn dây, đổi góc/neo hoặc kéo giãn thiết bị. Không tự di chuyển thiết bị để che lỗi đi dây.

**Tự sắp xếp** là thao tác khác: sắp lại cả vị trí thiết bị, góc dây và neo theo bố cục tự động.

Sơ đồ vẫn khóa mặc định. Người xem chỉ xem, chọn thiết bị, pan/zoom và bật/tắt thước; không kéo hay lưu góc/neo/vị trí.
