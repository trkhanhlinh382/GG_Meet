# BÁO CÁO PHÂN TÍCH USE CASE (UC) - PHÂN HỆ QUẢN TRỊ & NGƯỜI DÙNG

Báo cáo này mô tả chi tiết các Use Case (Trường hợp sử dụng) cho phần bổ sung tính năng Quản trị hệ thống (Admin Portal) và tính năng kiểm thử vai trò người dùng (App / User Bypass) của dự án **GG Meet**.

---

## 1. Tóm tắt các Actor (Tác nhân)

* **Admin (Quản trị viên):** Người quản lý hệ thống, có quyền truy cập vào phân hệ Quản trị để theo dõi số liệu và thực hiện các thao tác quản lý tài khoản người dùng.
* **User / Host (Người dùng thường):** Người sử dụng tính năng họp trực tuyến của GG Meet. Ở môi trường phát triển (DEV), có quyền tự nâng cấp vai trò để kiểm thử phân hệ quản trị.

---

## 2. Danh sách các Use Case (UC)

```mermaid
usecaseDiagram
  actor Admin
  actor User as "User (Host)"
  
  Admin --> UC01 : "Xem thống kê hệ thống"
  Admin --> UC02 : "Xem danh sách người dùng"
  Admin --> UC03 : "Thêm người dùng thủ công"
  Admin --> UC04 : "Sửa thông tin người dùng"
  Admin --> UC05 : "Xóa tài khoản người dùng"
  
  User --> UC06 : "Bypass vai trò (DEV)"
```

---

## 3. Đặc tả chi tiết các Use Case (UC)

### UC-01: Xem thống kê hệ thống (View System Stats)
* **Actor chính:** Admin.
* **Mô tả:** Admin xem tổng quan về tình trạng hệ thống thông qua các số liệu thống kê trực quan.
* **Luồng sự kiện chính (Basic Flow):**
  1. Admin đăng nhập vào hệ thống với tài khoản có vai trò `admin`.
  2. Hệ thống hiển thị liên kết **"Quản trị"** trên thanh menu Sidebar.
  3. Admin nhấp chọn **"Quản trị"**.
  4. Hệ thống chuyển hướng tới trang `/admin` và tự động gửi yêu cầu GET tới `/api/admin/stats`.
  5. Máy chủ xử lý dữ liệu và trả về: Tổng số người dùng, số cuộc họp đang diễn ra, tổng số cuộc họp đã tạo, tổng số thư mời, tỷ lệ cơ cấu vai trò (`admin` vs `host`), và danh sách 5 tài khoản đăng ký mới nhất.
  6. Hệ thống hiển thị các số liệu dạng thẻ chỉ số (Card Stats), biểu đồ phần trăm (Progress Bar), và danh sách đăng ký mới.
* **Ngoại lệ (Exceptions):**
  * *Tài khoản không phải Admin truy cập trực tiếp link `/admin`:* Hệ thống từ chối truy cập và chuyển hướng về trang Dashboard người dùng `/dashboard`.

---

### UC-02: Xem danh sách người dùng (View User List)
* **Actor chính:** Admin.
* **Mô tả:** Admin xem danh sách tất cả người dùng trong hệ thống kèm khả năng tìm kiếm, phân trang và lọc theo vai trò.
* **Luồng sự kiện chính (Basic Flow):**
  1. Admin truy cập trang **Quản trị**.
  2. Admin nhấp vào tab **"Quản lý User"**.
  3. Hệ thống gửi yêu cầu GET tới `/api/admin/users` kèm theo các tham số mặc định (`page=1`, `limit=10`).
  4. Hệ thống hiển thị danh sách người dùng dạng bảng gồm: Họ tên (avatar), Email, Vai trò (Tag màu sắc), Múi giờ, và Ngày tham gia.
  5. *Tìm kiếm:* Admin nhập tên hoặc email vào ô tìm kiếm. Hệ thống tự động lọc danh sách và hiển thị kết quả khớp.
  6. *Lọc:* Admin chọn lọc vai trò (`Admin` hoặc `User (Host)`). Bảng dữ liệu tự động cập nhật tương ứng.
  7. *Phân trang:* Admin nhấp nút chuyển trang (Trang sau/trước), hệ thống tải tiếp danh sách người dùng của trang tương ứng.

---

### UC-03: Thêm người dùng thủ công (Add User Manually)
* **Actor chính:** Admin.
* **Mô tả:** Admin thêm một người dùng mới vào hệ thống trực tiếp mà không cần qua luồng đăng nhập Google OAuth.
* **Luồng sự kiện chính (Basic Flow):**
  1. Admin chọn tab **"Quản lý User"**.
  2. Admin nhấp vào nút **"Thêm thành viên"**.
  3. Hệ thống hiển thị Modal form nhập thông tin gồm: Họ và tên, Email, Vai trò (`host`/`admin`), và Múi giờ.
  4. Admin điền thông tin và nhấp **"Xác nhận"**.
  5. Hệ thống gửi yêu cầu POST tới `/api/admin/users`.
  6. Máy chủ kiểm tra định dạng email và kiểm tra trùng lặp email:
     * Nếu email đã tồn tại, hiển thị thông báo lỗi.
     * Nếu hợp lệ, hệ thống tạo tài khoản mới trong cơ sở dữ liệu với mã Google ID ảo (`manual_[timestamp]`) và avatar mặc định.
  7. Máy chủ trả về mã HTTP `201 Created`.
  8. Hệ thống đóng Modal form, hiển thị thông báo thành công và tự động làm mới danh sách bảng người dùng.

---

### UC-04: Sửa thông tin người dùng (Edit User Info)
* **Actor chính:** Admin.
* **Mô tả:** Admin cập nhật thông tin cá nhân hoặc thay đổi quyền (vai trò) của người dùng hiện có.
* **Luồng sự kiện chính (Basic Flow):**
  1. Admin tìm tài khoản cần sửa trong bảng quản lý người dùng và nhấp nút biểu tượng **Sửa (Edit)** ở cột thao tác.
  2. Hệ thống hiển thị Modal form chứa sẵn dữ liệu cũ của người dùng được chọn.
  3. Admin thực hiện thay đổi thông tin (ví dụ: Thay đổi vai trò từ `host` thành `admin`).
  4. Admin nhấp nút **"Lưu thay đổi"**.
  5. Hệ thống gửi yêu cầu PUT tới `/api/admin/users/:id`.
  6. Máy chủ xác thực thông tin cập nhật (kiểm tra trùng lặp email nếu có thay đổi email) rồi lưu vào cơ sở dữ liệu.
  7. Hệ thống thông báo thành công, đóng Modal và làm mới bảng dữ liệu người dùng.

---

### UC-05: Xóa tài khoản người dùng (Delete User)
* **Actor chính:** Admin.
* **Mô tả:** Admin xóa vĩnh viễn tài khoản người dùng ra khỏi hệ thống.
* **Luồng sự kiện chính (Basic Flow):**
  1. Admin nhấp nút biểu tượng **Xóa (Delete)** tại dòng của người dùng cần xóa.
  2. Hệ thống hiển thị hộp thoại cảnh báo để xác nhận hành động: **"Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác"**.
  3. Admin chọn **"Xóa"**.
  4. Hệ thống gửi yêu cầu DELETE tới `/api/admin/users/:id`.
  5. Máy chủ thực hiện xóa tài khoản trong cơ sở dữ liệu và trả về kết quả.
  6. Hệ thống hiển thị thông báo xóa thành công và tải lại bảng danh sách người dùng.
* **Quy tắc kiểm tra (Business Rules):**
  * Admin **không được phép tự xóa tài khoản của chính mình**. Nếu cố tình bấm xóa chính mình, máy chủ sẽ trả về lỗi HTTP 400 và hệ thống hiển thị thông báo lỗi.

---

### UC-06: Bypass vai trò thử nghiệm (Dev Role Promotion)
* **Actor chính:** User / Host.
* **Điều kiện tiên quyết:** Ứng dụng phải chạy trên môi trường phát triển (DEV - `import.meta.env.DEV === true`).
* **Mô tả:** Người dùng tự thay đổi vai trò của mình giữa `host` và `admin` nhanh chóng để phục vụ kiểm thử tính năng mà không cần can thiệp cơ sở dữ liệu.
* **Luồng sự kiện chính (Basic Flow):**
  1. Người dùng đăng nhập thành công vào trang Dashboard.
  2. Tại góc dưới bên trái Sidebar (bảng thông tin User), hệ thống hiển thị vai trò hiện tại (ví dụ: `host`) kèm nút **"Bypass Role"**.
  3. Người dùng nhấp nút **"Bypass Role"**.
  4. Hệ thống gửi yêu cầu PUT tới `/api/auth/dev-promote` kèm Token xác thực hiện tại.
  5. Máy chủ kiểm tra token hợp lệ, lấy ID của người dùng, thực hiện đảo vai trò (nếu đang là `admin` chuyển thành `host`, nếu đang là `host` chuyển thành `admin`), lưu vào DB.
  6. Máy chủ tạo mã JWT mới chứa vai trò đã thay đổi và trả về Client.
  7. Client lưu token mới vào LocalStorage, cập nhật state của ứng dụng.
  8. Sidebar tự động cập nhật:
     * Nếu vừa thăng cấp thành `admin`: Nhãn vai trò đổi thành `admin` (màu đỏ) và menu **"Quản trị"** xuất hiện.
     * Nếu vừa hạ cấp thành `host`: Nhãn đổi thành `host` (màu xanh) và menu **"Quản trị"** biến mất.
