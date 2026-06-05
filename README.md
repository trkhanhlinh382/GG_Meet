# Hướng dẫn Cấu hình, Build và Khởi chạy dự án GG Meet

Dự án **GG Meet** được cấu trúc dưới dạng Monorepo sử dụng tính năng **npm Workspaces**. Cấu trúc này cho phép quản lý cả mã nguồn Client (React) và Server (NodeJS/Express) cùng lúc một cách dễ dàng và đồng bộ.

---

## 1. Yêu cầu hệ thống
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js** phiên bản 20 trở lên.
- **npm** phiên bản 10 trở lên.
- **MongoDB** (Có thể chạy local hoặc qua Docker / Cloud Atlas).

---

## 2. Cài đặt các thư viện (Dependencies)
Do dự án sử dụng npm Workspaces, bạn **chỉ cần chạy một lệnh duy nhất ở thư mục gốc** của dự án để cài đặt thư viện cho cả Client, Server và thư mục Root:

```bash
# Thực hiện tại thư mục gốc của dự án (GG_Meet)
npm install
```

Lệnh này sẽ tự động phân tích và cài đặt tất cả các gói phụ thuộc cần thiết cho cả hai thư mục con `client` và `server`.

---

## 3. Cấu hình biến môi trường (Environment Variables)

Bạn cần tạo và thiết lập các file `.env` cho cả Client và Server:

### A. Cấu hình cho Server (`server/.env`)
Tạo file `server/.env` (bạn có thể copy từ `server/.env.example`) và điền đầy đủ các thông số sau:

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:2717/gg_meet # URL kết nối CSDL MongoDB
CLIENT_URL=http://localhost:5173              # Địa chỉ chạy Client React

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
```

### B. Cấu hình cho Client (`client/.env`)
Tạo file `client/.env` (bạn có thể copy từ `client/.env.example`) và cấu hình:

```env
VITE_API_BASE_URL=http://localhost:4000/api   # API Endpoint của Server
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here # Trùng với Client ID ở Server
```

---

## 4. Hướng dẫn Build dự án (Client & Server)

Để biên dịch dự án sang phiên bản Production (tối ưu hóa hiệu năng, giảm dung lượng mã nguồn), bạn có thể chạy các lệnh build sau từ **thư mục gốc**:

### A. Build toàn bộ dự án (Cả Client & Server)
```bash
npm run build
```
Lệnh này sẽ tuần tự kích hoạt quy trình build cho cả Client và Server.

### B. Chỉ Build Client (React)
```bash
npm run build:client
```
*   **Công nghệ sử dụng:** Vite & TypeScript.
*   **Thư mục đầu ra:** `client/dist/` (Chứa các file tĩnh HTML, JS, CSS đã được tối ưu hóa).

### C. Chỉ Build Server (NodeJS/Express)
```bash
npm run build:server
```
*   **Công nghệ sử dụng:** TypeScript Compiler (`tsc`).
*   **Thư mục đầu ra:** `server/dist/` (Biên dịch toàn bộ file `.ts` sang `.js` chạy trực tiếp trên môi trường NodeJS).

---

## 5. Hướng dẫn Khởi chạy ứng dụng

### A. Chạy ở chế độ Phát triển (Development)
Chạy đồng thời cả Client và Server ở chế độ dev (hỗ trợ Hot-Reload tự động tải lại trang khi sửa code):

```bash
# Thực hiện tại thư mục gốc
npm run dev
```

*   **Giao diện Client:** [http://localhost:5173](http://localhost:5173)
*   **API Server:** [http://localhost:4000/api](http://localhost:4000/api)
*   **Health Check API:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

### B. Chạy ở chế độ Productive (Sau khi đã Build)
Sau khi đã chạy lệnh `npm run build` thành công, bạn có thể chạy Server ở chế độ production:

```bash
# Khởi chạy server production
npm start
```

---

## 6. Chạy các kiểm thử (Run Tests)
Để chạy các bộ kiểm thử tích hợp (Integration tests) và kiểm thử đơn vị (Unit tests) của Backend:

```bash
# Chạy toàn bộ test suites của Server
npm run test --workspace=server
```
Danh sách kiểm thử sẽ bao gồm: xác thực môi trường, tính toán lịch họp định kỳ, luồng tạo phòng họp, gửi/phản hồi thư mời, kết thúc cuộc họp và xóa các dữ liệu liên quan.
