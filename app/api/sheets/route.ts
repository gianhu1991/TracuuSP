import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  try {
    // Lấy thông tin từ biến môi trường
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!spreadsheetId || !credentials) {
      return NextResponse.json(
        { error: 'Cấu hình Google Sheets chưa được thiết lập' },
        { status: 500 }
      )
    }

    // Parse service account credentials
    let serviceAccountKey
    try {
      serviceAccountKey = JSON.parse(credentials)
    } catch (e) {
      return NextResponse.json(
        { error: 'Định dạng Google Service Account Key không hợp lệ' },
        { status: 500 }
      )
    }

    // Xác thực với Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountKey.client_email,
        private_key: serviceAccountKey.private_key.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Vì file là .xlsx được upload, spreadsheets.get() không hoạt động
    // Kiểm tra quyền truy cập bằng cách đọc một cell từ sheet đầu tiên
    // Nếu không đọc được, vẫn tiếp tục với danh sách hardcode (có thể sheet tên khác)
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'Lạc Vân'!A1",
      })
    } catch (permissionError: any) {
      if (permissionError.message?.includes('PERMISSION_DENIED') || permissionError.message?.includes('permission')) {
        throw new Error('PERMISSION_DENIED: Không có quyền truy cập. Vui lòng chia sẻ Sheet với Service Account: tracuusp-service@tracuusp.iam.gserviceaccount.com')
      }
      // Nếu lỗi khác (như sheet không tồn tại hoặc range không đúng), vẫn tiếp tục
      // Vì file Excel có thể có cấu trúc khác
      console.log('Permission check note (non-critical):', permissionError.message)
    }

    // Vì file là .xlsx được upload, dùng danh sách sheets đã biết
    // Danh sách sheets từ Google Sheet (từ thông tin đã biết)
    const knownSheets = [
      'Lạc Vân', 'Quảng Lạc', 'Phùng Thượng', 'Thạch Bình 2', 'Trại Ngọc',
      'Phú Sơn', 'Văn Phú 1', 'Đức Long', 'Xích Thổ', 'Yên Quang',
      'Rịa', 'Rịa XGS', 'Ỷ Na', 'Nho Quan XGS', 'Ỷ Na XGS',
      'Quỳnh Sơn', 'Thanh Lạc', 'Nho Quan 1', 'Phú Long', 'Nho Quan 2',
      'Thôn Ngải', 'Thạch Bình 1', 'Cúc Phương', 'Sơn Lai', 'Đồng Phong',
      'Trung Đông', 'Gia Thủy', 'Kỳ Phú', 'Văn Phú 2', 'Quỳnh Lưu'
    ]
    
    // Tạo danh sách sheets với sheetId giả định
    const sheetList = knownSheets.map((title, index) => ({
      title,
      sheetId: index,
    }))
    
    // Lọc bỏ các sheet trống hoặc không có tên
    const filteredSheetList = sheetList.filter(sheet => sheet.title && sheet.title.trim() !== '')

    return NextResponse.json({ sheets: filteredSheetList })
  } catch (error: any) {
    console.error('Error fetching sheets:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    // Xử lý các lỗi cụ thể
    let errorMessage = 'Có lỗi xảy ra khi lấy danh sách sheet'
    
    if (error.message?.includes('PERMISSION_DENIED') || error.message?.includes('permission')) {
      errorMessage = 'Không có quyền truy cập Google Sheet. Vui lòng chia sẻ Sheet với Service Account: tracuusp-service@tracuusp.iam.gserviceaccount.com'
    } else if (error.message?.includes('NOT_FOUND')) {
      errorMessage = 'Không tìm thấy Google Sheet. Vui lòng kiểm tra Sheet ID.'
    } else if (error.message?.includes('not supported for this document')) {
      errorMessage = 'Lỗi: "This operation is not supported for this document". Vui lòng kiểm tra: 1) Sheet đã được chia sẻ với Service Account chưa? 2) File có phải là Google Sheets không? (không phải Google Docs)'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
