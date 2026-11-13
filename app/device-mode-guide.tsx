import {Copy} from 'lucide-react';
export default function DeviceModeGuide({copy}:{copy:(text:string)=>void}){
 const check='/system device-mode print';
 const enable='/system device-mode update fetch=yes scheduler=yes';
 return <details className="device-mode-guide" open><summary><strong>KTV cần kiểm tra quyền fetch và scheduler trước khi cài</strong></summary>
  <p>NetWatch dùng <code>fetch</code> để gửi dữ liệu và <code>scheduler</code> để chạy định kỳ. Hai chức năng có thể đang bị tắt trong device-mode, đặc biệt ở chế độ home; không phải mọi MikroTik đều mặc định tắt.</p>
  <ol>
   <li>Mở <strong>WinBox → New Terminal</strong>, kiểm tra:</li>
  </ol>
  <div className="code-block"><code>{check}</code><button type="button" onClick={()=>copy(check)} aria-label="Sao chép lệnh kiểm tra device-mode"><Copy size={16}/></button></div>
  <p>Nếu đã thấy <code>fetch: yes</code> và <code>scheduler: yes</code>, bỏ qua bước bật quyền và tiếp tục tạo bộ cài.</p>
  <ol start={2}><li>Nếu một trong hai là <code>no</code>, KTV có mặt tại router chạy:</li></ol>
  <div className="code-block"><code>{enable}</code><button type="button" onClick={()=>copy(enable)} aria-label="Sao chép lệnh bật fetch và scheduler"><Copy size={16}/></button></div>
  <ol start={3}>
   <li>Chờ Terminal hiện yêu cầu xác nhận, rồi trong thời gian đếm ngược (mặc định 5 phút), <strong>nhấn nhanh rồi thả nút RESET hoặc MODE</strong> trên router đang chạy. Không giữ nút lâu, không giữ RESET khi cấp nguồn. Một số thiết bị cũ chỉ hỗ trợ xác nhận bằng cách ngắt toàn bộ nguồn rồi cấp lại; nếu dùng đồng thời adapter và PoE, phải ngắt cả hai.</li>
   <li>Router sẽ <strong>khởi động lại, mạng gián đoạn tạm thời</strong>. Lệnh reboot trong WinBox/Terminal không thay thế xác nhận vật lý. Chỉ thao tác khi đã sắp xếp thời điểm gián đoạn mạng.</li>
   <li>Đăng nhập lại WinBox, chạy lại lệnh kiểm tra và xác nhận cả <code>fetch: yes</code>, <code>scheduler: yes</code>, rồi mới cài hoặc chạy lại collector.</li>
  </ol>
  <p className="step-note">Lệnh chỉ bật hai quyền cần thiết, giữ nguyên chế độ hiện tại. Nếu hết thời gian hoặc báo quá nhiều lần thử, đọc thông báo Terminal; không gửi lặp lệnh khi đang chờ xác nhận. Nếu không có menu device-mode hoặc thao tác xác nhận khác với hướng dẫn, kiểm tra tài liệu đúng phiên bản/model trước khi tiếp tục.</p>
  <a href="https://manual.mikrotik.com/docs/system-information-and-utilities/device-mode/" target="_blank" rel="noopener noreferrer">Tài liệu device-mode chính thức của MikroTik</a>
 </details>;
}
