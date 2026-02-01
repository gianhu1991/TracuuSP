import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Helper function để lấy Sheet ID dựa trên Tổ kỹ thuật
function getSheetId(toKyThuat: string | null): string | null {
  if (toKyThuat === 'Nho Quan') {
    return process.env.GOOGLE_SHEET_ID_NHO_QUAN || null
  } else if (toKyThuat === 'Gia Viễn') {
    return process.env.GOOGLE_SHEET_ID_GIA_VIEN || null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { olt, toKyThuat } = await request.json()

    if (!olt) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp OLT' },
        { status: 400 }
      )
    }
    
    if (!toKyThuat) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp Tổ kỹ thuật' },
        { status: 400 }
      )
    }

    // Lấy Sheet ID dựa trên Tổ kỹ thuật
    const spreadsheetId = getSheetId(toKyThuat)
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!spreadsheetId || !credentials) {
      return NextResponse.json(
        { error: `Cấu hình Google Sheets cho Tổ KT ${toKyThuat} chưa được thiết lập. Vui lòng kiểm tra biến môi trường GOOGLE_SHEET_ID_${toKyThuat.toUpperCase().replace(' ', '_')}` },
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

    // Đọc dữ liệu từ sheet (tên sheet = tên OLT)
    // Sử dụng cùng cách như API search đang dùng
    const sheetName = olt.trim()
    
    let response
    try {
      // Thử đọc với dấu nháy đơn (cách API search đang dùng)
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:J`,
      })
    } catch (rangeError: any) {
      // Nếu lỗi "not supported", có thể là do file Excel
      // Thử đọc không có dấu nháy
      if (rangeError.message?.includes('not supported') || rangeError.message?.includes('Unable to parse')) {
        try {
          response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:J`,
          })
      } catch (e2: any) {
        // Nếu vẫn lỗi "not supported", có thể file Excel không hỗ trợ đọc trực tiếp
        // Nhưng có thể vẫn đọc được qua API search
        // Trả về danh sách rỗng và log warning
        console.warn(`Cannot read sheet "${sheetName}" directly:`, e2.message)
        console.warn('This might be due to Excel file format. Try using search API instead.')
        // Trả về danh sách rỗng - frontend sẽ xử lý
        return NextResponse.json({ slots: [], ports: [], warning: 'Không thể đọc trực tiếp từ file Excel. Vui lòng thử tra cứu trực tiếp.' })
      }
      } else {
        throw rangeError
      }
    }

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return NextResponse.json({ slots: [], ports: [] })
    }

    // Đọc trực tiếp từ cột B (index 1) và cột C (index 2)
    // Vì cấu trúc: Cột A = OLT, Cột B = Slot, Cột C = Port
    const slotIndex = 1  // Cột B
    const portIndex = 2  // Cột C

    // Lấy danh sách Slot và Port duy nhất
    const slotsSet = new Set<string>()
    const portsSet = new Set<string>()
    
    // Xử lý merged cells - lưu giá trị hiện tại
    let currentSlot = ''
    let currentPort = ''
    
    // Bắt đầu từ hàng 2 (index 1) vì hàng 1 là header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      
      // Xử lý Slot (cột B, index 1)
      if (row[slotIndex] && row[slotIndex].toString().trim() !== '') {
        currentSlot = row[slotIndex].toString().trim()
      }
      if (currentSlot && currentSlot !== '_' && currentSlot !== '') {
        slotsSet.add(currentSlot)
      }
      
      // Xử lý Port (cột C, index 2)
      if (row[portIndex] && row[portIndex].toString().trim() !== '') {
        currentPort = row[portIndex].toString().trim()
      }
      if (currentPort && currentPort !== '_' && currentPort !== '') {
        portsSet.add(currentPort)
      }
    }

    // Chuyển Set thành Array và sắp xếp
    const slots = Array.from(slotsSet).sort((a, b) => {
      const numA = parseInt(a) || 0
      const numB = parseInt(b) || 0
      return numA - numB
    })
    
    const ports = Array.from(portsSet).sort((a, b) => {
      const numA = parseInt(a) || 0
      const numB = parseInt(b) || 0
      return numA - numB
    })

    return NextResponse.json({ slots, ports })
  } catch (error: any) {
    console.error('Error fetching slots/ports:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    let errorMessage = 'Có lỗi xảy ra khi lấy danh sách Slot và Port'
    
    if (error.message?.includes('PERMISSION_DENIED') || error.message?.includes('permission')) {
      errorMessage = 'Không có quyền truy cập Google Sheet. Vui lòng chia sẻ Sheet với Service Account.'
    } else if (error.message?.includes('NOT_FOUND')) {
      errorMessage = `Không tìm thấy sheet. Vui lòng kiểm tra tên sheet.`
    } else if (error.message?.includes('not supported for this document')) {
      errorMessage = 'Lỗi: File Excel được upload có thể không hỗ trợ đầy đủ. Vui lòng thử lại hoặc kiểm tra quyền truy cập.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
