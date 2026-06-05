# Kế Hoạch Nâng Cấp Hệ Thống Vai Trò (User Roles) Trong Tương Lai

Tài liệu này mô tả các vai trò nâng cao và tính năng tương ứng dự kiến sẽ phát triển và tích hợp vào hệ thống **GG Meet** trong các giai đoạn tiếp theo.

---

## 1. Cơ cấu vai trò mở rộng (Extended User Roles)

Trong tương lai, hệ thống sẽ hỗ trợ 7 vai trò để đáp ứng nhu cầu kinh doanh (SaaS) và quản lý doanh nghiệp:

| Vai trò | Phân nhóm | Mục đích sử dụng |
| :--- | :--- | :--- |
| **`personal`** | Người dùng cuối | Người dùng cá nhân sử dụng các tính năng miễn phí cơ bản. |
| **`freelancer`** | Người dùng cuối | Chuyên gia làm việc tự do cần tính năng lên lịch & họp không giới hạn. |
| **`team_member`**| Người dùng cuối | Thành viên thuộc một tổ chức/doanh nghiệp cộng tác nội bộ. |
| **`host`** | Điều phối | Người chủ trì cuộc họp sở hữu đầy đủ quyền kiểm soát phòng họp. |
| **`manager`** | Điều phối | Quản lý bộ phận có quyền lên lịch họp hộ và theo dõi công việc. |
| **`admin`** | Quản trị | Quản trị viên hệ thống giám sát người dùng, cuộc họp và tài nguyên. |
| **`super_admin`**| Quản trị | Quản trị viên tối cao quản lý cấu hình hệ thống và cổng thanh toán. |

---

## 2. Chi tiết tính năng đề xuất cho từng vai trò

### Giai đoạn 1: Nâng cấp Nhóm Người dùng cuối (Kinh doanh SaaS)

#### **`personal` (Cá nhân - Miễn phí)**
* **Thời lượng cuộc họp:** Giới hạn tối đa 40 phút/cuộc họp.
* **Số người tham gia:** Tối đa 50 thành viên.
* **Tính năng phòng họp:** Hỗ trợ chia sẻ màn hình, chat trực tuyến.
* **Giới hạn lưu trữ:** Không hỗ trợ ghi âm cuộc họp lên Cloud.

#### **`freelancer` (Làm việc tự do - Trả phí cá nhân)**
* **Thời lượng cuộc họp:** Không giới hạn (tối đa 24 giờ).
* **Số người tham gia:** Tối đa 150 thành viên.
* **Tính năng nâng cao:**
  * Hỗ trợ **ghi âm cuộc họp** trực tiếp lên đám mây (Cloud Recording) và tải file.
  * Tùy chỉnh đường dẫn phòng họp đẹp (Personal Meeting Link - ví dụ: `ggmeet.com/room/viet-dung`).
  * Tạo lịch hẹn trực tiếp (giống Calendly) để đối tác tự chọn giờ họp trống.

#### **`team_member` (Thành viên doanh nghiệp - Đăng ký tổ chức)**
* **Tính năng cộng tác:**
  * Truy cập danh bạ nội bộ công ty để tìm kiếm đồng nghiệp nhanh chóng.
  * Chia sẻ chung bảng trắng tương tác (Interactive Whiteboard) và lưu bản vẽ tự động vào thư mục nhóm.
  * Phân công công việc (**Tasks**) ngay trong phòng họp và tự động đồng bộ về Dashboard cá nhân.

---

### Giai đoạn 2: Nâng cấp Nhóm Điều phối cuộc họp

#### **`host` (Người chủ trì cuộc họp)**
* **Quyền kiểm soát phòng họp nâng cao:**
  * Cho phép tắt tiếng (Mute) hoặc tắt camera của bất kỳ thành viên nào.
  * Thiết lập quyền chia sẻ màn hình, nhắn tin chat, vẽ lên bảng cho các thành viên.
  * Duyệt người vào từ **Phòng chờ (Waiting Room)** hoặc chặn/kick người dùng ra khỏi phòng họp.
  * Tạo phòng thảo luận nhóm nhỏ (Breakout Rooms).

#### **`manager` (Quản lý doanh nghiệp)**
* **Quyền hạn quản lý lịch trình:**
  * Lên lịch họp thay cho nhân viên dưới quyền (Schedule on behalf of).
  * Xem báo cáo thống kê chuyên sâu về thời gian tham gia họp, mức độ tương tác của nhân viên trong các buổi họp nhóm.
  * Phê duyệt yêu cầu đăng ký lịch họp của phòng ban.

---

### Giai đoạn 3: Nâng cấp Nhóm Quản trị hệ thống

#### **`admin` (Quản trị viên)**
* **Công cụ quản trị hệ thống:**
  * Tra cứu, lọc, thêm mới, sửa đổi thông tin người dùng và phân quyền nhanh.
  * Khóa tài khoản (Ban/Deactivate) đối với các tài khoản vi phạm chính sách.
  * Xem tổng lượng băng thông, số cuộc họp đang diễn ra đồng thời.

#### **`super_admin` (Quản trị viên tối cao)**
* **Cấu hình hệ thống cốt lõi:**
  * Quản lý gói giá dịch vụ (Pricing Plans) và cổng thanh toán (Stripe, Paypal...).
  * Cấu hình máy chủ truyền tải WebRTC (STUN/TURN Servers) phục vụ xử lý luồng Video/Audio.
  * Quản lý phân quyền cho các tài khoản `admin` khác.
  * Xuất báo cáo doanh thu và báo cáo hệ thống tổng thể.
