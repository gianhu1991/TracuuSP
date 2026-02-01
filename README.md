# Ứng dụng Tra cứu Spliter cấp 2

Ứng dụng web để tra cứu thông tin Spliter cấp 2 theo OLT, Slot và Port. Dữ liệu được lấy từ Google Sheets.

## Tính năng

- Tra cứu Spliter cấp 2 theo OLT, Slot, Port
- Kết nối với Google Sheets để lấy dữ liệu real-time
- Giao diện đẹp, responsive
- Deploy dễ dàng lên Vercel

## Cấu trúc dữ liệu Google Sheet

Sheet cần có các cột sau (theo thứ tự):
- **OLT** (Cột A): Tên OLT
- **Slot** (Cột B): Số slot
- **Port** (Cột C): Số port
- **Hộp** (Cột D): Mã hộp
- **Dây nhảy** (Cột E): Mã dây nhảy
- **Spliter cấp 1** (Cột F): Mã spliter cấp 1
- **Cáp** (Cột G): Mã cáp
- **Spliter cấp 2** (Cột H): Mã spliter cấp 2
- **Spliter cấp 2** (Cột I): Tên/ mô tả spliter cấp 2
- **Trạng thái** (Cột J): Trạng thái (Đã vẽ, chưa có, ...)

## Cài đặt

### 1. Clone repository và cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình Google Sheets API

#### Bước 1: Tạo Service Account

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Vào **APIs & Services** > **Library**
4. Tìm và bật **Google Sheets API**
5. Vào **APIs & Services** > **Credentials**
6. Click **Create Credentials** > **Service Account**
7. Đặt tên cho service account và tạo
8. Click vào service account vừa tạo
9. Vào tab **Keys** > **Add Key** > **Create new key**
10. Chọn **JSON** và tải file về

#### Bước 2: Chia sẻ Google Sheet với Service Account

1. Mở Google Sheet của bạn
2. Click **Share** (Chia sẻ)
3. Thêm email của service account (có dạng `xxx@xxx.iam.gserviceaccount.com`) với quyền **Viewer** (Người xem)
4. Copy **Sheet ID** từ URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

#### Bước 3: Chia sẻ Google Sheets với Service Account

1. Mở Google Sheet cho **Tổ KT Nho Quan**
2. Click **Share** (Chia sẻ)
3. Thêm email của service account với quyền **Viewer** (Người xem)
4. Copy **Sheet ID** từ URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
5. Lặp lại bước 1-4 cho Google Sheet của **Tổ KT Gia Viễn**

#### Bước 4: Cấu hình biến môi trường

1. Copy file `.env.example` thành `.env.local`
2. Điền các thông tin:
   - `GOOGLE_SHEET_ID_NHO_QUAN`: ID của Google Sheet cho Tổ KT Nho Quan
   - `GOOGLE_SHEET_ID_GIA_VIEN`: ID của Google Sheet cho Tổ KT Gia Viễn
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Copy toàn bộ nội dung file JSON key vào đây (dạng string)

**Lưu ý:** Cả 2 Google Sheet (Nho Quan và Gia Viễn) đều phải được chia sẻ với cùng một Service Account email.

### 3. Chạy ứng dụng

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem ứng dụng.

## Deploy lên Vercel

### 1. Push code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. Deploy trên Vercel

1. Truy cập [Vercel](https://vercel.com/)
2. Đăng nhập và click **New Project**
3. Import repository từ GitHub
4. Thêm các biến môi trường:
   - `GOOGLE_SHEET_ID_NHO_QUAN`: ID của Google Sheet cho Tổ KT Nho Quan
   - `GOOGLE_SHEET_ID_GIA_VIEN`: ID của Google Sheet cho Tổ KT Gia Viễn
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Nội dung file JSON key (dạng string)
5. Click **Deploy**

### 3. Cấu hình biến môi trường trên Vercel

Vào **Settings** > **Environment Variables** và thêm:
- `GOOGLE_SHEET_ID_NHO_QUAN`
- `GOOGLE_SHEET_ID_GIA_VIEN`
- `GOOGLE_SERVICE_ACCOUNT_KEY`

## Sử dụng

1. Chọn **Tổ kỹ thuật** (Tổ KT Nho Quan hoặc Tổ KT Gia Viễn)
2. Chọn **OLT** từ danh sách (sẽ tự động load sau khi chọn Tổ kỹ thuật)
3. Chọn **Slot** và **Port** (sẽ tự động load sau khi chọn OLT)
4. Click **Tra cứu**
5. Xem kết quả hiển thị trong bảng

## Công nghệ sử dụng

- **Next.js 14**: Framework React với App Router
- **TypeScript**: Type safety
- **Google Sheets API**: Lấy dữ liệu từ Google Sheets
- **Vercel**: Platform deploy

## License

MIT
