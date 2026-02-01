import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { drive_v3 } from 'googleapis'

// Disable caching để đảm bảo luôn lấy danh sách sheet mới nhất
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function để lấy Sheet ID dựa trên Tổ kỹ thuật
function getSheetId(toKyThuat: string | null): string | null {
  if (toKyThuat === 'Nho Quan') {
    return process.env.GOOGLE_SHEET_ID_NHO_QUAN || null
  } else if (toKyThuat === 'Gia Viễn') {
    return process.env.GOOGLE_SHEET_ID_GIA_VIEN || null
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    // Lấy query parameter toKyThuat
    const searchParams = request.nextUrl.searchParams
    const toKyThuat = searchParams.get('toKyThuat')
    
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
    const drive = google.drive({ version: 'v3', auth })

    // Thử lấy danh sách sheet thực tế từ Google Sheets API
    let sheetList: { title: string; sheetId: number }[] = []
    
    try {
      // Thử dùng spreadsheets.get() để lấy metadata (bao gồm danh sách sheets)
      // Đây là cách chính xác nhất và tự động nhất cho Google Sheets format
      console.log('🔍 Đang thử lấy danh sách sheet từ Google Sheets API...')
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId,
      })
      
      if (spreadsheetInfo.data.sheets && spreadsheetInfo.data.sheets.length > 0) {
        sheetList = spreadsheetInfo.data.sheets
          .map((sheet: any) => ({
            title: sheet.properties?.title || '',
            sheetId: sheet.properties?.sheetId || 0,
          }))
          .filter((sheet: any) => sheet.title && sheet.title.trim() !== '')
        
        console.log('✅ Lấy danh sách sheet thành công từ Google Sheets API:', sheetList.map(s => s.title))
        console.log(`📊 Tổng số sheet: ${sheetList.length}`)
        console.log('📋 Chi tiết sheets:', JSON.stringify(sheetList, null, 2))
        
        // Nếu đã lấy được danh sách từ API, return ngay (không fallback)
        if (sheetList.length > 0) {
          const filteredSheetList = sheetList.filter(sheet => sheet.title && sheet.title.trim() !== '')
          return NextResponse.json(
            { sheets: filteredSheetList },
            {
              headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
              },
            }
          )
        }
      } else {
        console.warn('⚠️ Không có sheet nào trong file')
      }
    } catch (apiError: any) {
      console.error('⚠️ Không thể lấy danh sách sheet từ Sheets API:', apiError.message)
      console.error('⚠️ Error details:', JSON.stringify(apiError, null, 2))
      
      // Nếu lỗi PERMISSION_DENIED, throw error
      if (apiError.message?.includes('PERMISSION_DENIED') || apiError.message?.includes('permission')) {
        throw new Error('PERMISSION_DENIED: Không có quyền truy cập. Vui lòng chia sẻ Sheet với Service Account: tracuusp-service@tracuusp.iam.gserviceaccount.com')
      }
      
      // Nếu lỗi "not supported for this document" (file .xlsx), thử dùng Drive API
      if (apiError.message?.includes('not supported for this document')) {
        console.log('⚠️ File .xlsx không hỗ trợ spreadsheets.get(), thử dùng Drive API...')
        
        try {
          // Thử dùng Drive API để export file và lấy thông tin
          // Hoặc thử đọc từng sheet để xem sheet nào tồn tại
          // Cách tốt nhất: thử đọc cell A1 từ nhiều sheet có thể có
          // Nhưng cách này không hiệu quả nếu có nhiều sheet
          
          // Thử cách khác: dùng Drive API để lấy file metadata
          // Nhưng Drive API không trả về danh sách sheet
          
          // Cách tốt nhất: thử đọc từng sheet từ danh sách có thể có
          // và chỉ trả về những sheet đọc được
          console.log('⚠️ Đang thử đọc từng sheet để lấy danh sách...')
          
          // Danh sách sheet có thể có (mở rộng để bao gồm nhiều khả năng)
          // Bao gồm cả các biến thể tên có thể có
          // Lưu ý: Nếu đổi tên sheet thành tên hoàn toàn mới, cần thêm vào danh sách này
          const possibleSheets = [
            'Lạc Vân', 'Quảng Lạc', 'Phùng Thượng', 'Thạch Bình 2', 'Trại Ngọc',
            'Phú Sơn', 'Văn Phú 1', 'Đức Long', 'Xích Thổ', 'Yên Quang',
            'Rịa', 'Rịa XGS', 'Rịa nhu', 'Rịa XG', 'Rịa XG S', 'Ria XGS', 'Ria XG',
            'Ỷ Na', 'Nho Quan XGS', 'Ỷ Na XGS', 'Nho Quan GX', 'Nho Quan XG',
            'Quỳnh Sơn', 'Thanh Lạc', 'Nho Quan 1', 'Nho Quan 2', 'Phú Long',
            'Thôn Ngải', 'Thạch Bình 1', 'Cúc Phương', 'Sơn Lai', 'Đồng Phong',
            'Trung Đông', 'Gia Thủy', 'Kỳ Phú', 'Văn Phú 2', 'Quỳnh Lưu',
            // Thêm các sheet có thể có khác (nếu có)
            'Sheet1', 'Sheet2', 'Sheet3', 'Data', 'Data1', 'Data2'
          ]
          
          console.log('🔍 Đang thử phát hiện sheet từ danh sách có thể có:', possibleSheets.length, 'sheets')
          
          // Thử đọc từng sheet để xem sheet nào tồn tại
          // Sử dụng Promise.allSettled để đọc song song (nhanh hơn) và không bị lỗi khi một sheet không tồn tại
          const sheetChecks = await Promise.allSettled(
            possibleSheets.map(async (sheetName, index) => {
              try {
                // Thử đọc cell A1 từ sheet này (với cả 2 cách: có và không có dấu nháy)
                let readSuccess = false
                try {
                  await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `'${sheetName}'!A1`,
                  })
                  readSuccess = true
                } catch (e1: any) {
                  // Thử không có dấu nháy
                  try {
                    await sheets.spreadsheets.values.get({
                      spreadsheetId,
                      range: `${sheetName}!A1`,
                    })
                    readSuccess = true
                  } catch (e2: any) {
                    // Cả 2 cách đều lỗi, sheet không tồn tại
                    readSuccess = false
                  }
                }
                
                if (readSuccess) {
                  console.log(`✅ Tìm thấy sheet: "${sheetName}"`)
                  return { title: sheetName, sheetId: index, exists: true }
                } else {
                  return { title: sheetName, sheetId: index, exists: false }
                }
              } catch (e: any) {
                // Nếu lỗi khác, sheet không tồn tại
                return { title: sheetName, sheetId: index, exists: false }
              }
            })
          )
          
          // Lọc ra những sheet tồn tại
          const existingSheets = sheetChecks
            .filter((result): result is PromiseFulfilledResult<{ title: string; sheetId: number; exists: boolean }> => 
              result.status === 'fulfilled' && result.value.exists
            )
            .map(result => ({
              title: result.value.title,
              sheetId: result.value.sheetId,
            }))
          
          if (existingSheets.length > 0) {
            sheetList = existingSheets
            console.log('✅ Lấy danh sách sheet bằng cách thử đọc từng sheet:', sheetList.map(s => s.title))
            console.log(`📊 Tổng số sheet tìm thấy: ${sheetList.length}/${possibleSheets.length}`)
          } else {
            console.warn('⚠️ Không tìm thấy sheet nào từ danh sách có thể có')
            console.warn('💡 Gợi ý: 1) Kiểm tra tên sheet trong Google Sheet, 2) Thêm tên sheet mới vào danh sách possibleSheets trong code')
          }
        } catch (driveError: any) {
          console.error('⚠️ Lỗi khi thử lấy danh sách sheet:', driveError.message)
          // Tiếp tục với danh sách fallback
        }
      } else {
        // Nếu lỗi khác, throw lại
        throw apiError
      }
    }
    
    // Nếu không lấy được danh sách, dùng danh sách fallback (để tránh lỗi)
    if (sheetList.length === 0) {
      console.warn('⚠️ Không lấy được danh sách sheet, dùng danh sách fallback')
      // TODO: Cập nhật danh sách sheet này khi user đổi tên sheet trong Google Sheet
      // Nếu file là .xlsx, danh sách này sẽ được dùng làm fallback
      const knownSheets = [
        'Lạc Vân', 'Quảng Lạc', 'Phùng Thượng', 'Thạch Bình 2', 'Trại Ngọc',
        'Phú Sơn', 'Văn Phú 1', 'Đức Long', 'Xích Thổ', 'Yên Quang',
        'Rịa', 'Rịa XGS', 'Rịa nhu', 'Ỷ Na', 'Nho Quan XGS', 'Ỷ Na XGS',
        'Quỳnh Sơn', 'Thanh Lạc', 'Nho Quan 1', 'Phú Long', 'Nho Quan 2',
        'Thôn Ngải', 'Thạch Bình 1', 'Cúc Phương', 'Sơn Lai', 'Đồng Phong',
        'Trung Đông', 'Gia Thủy', 'Kỳ Phú', 'Văn Phú 2', 'Quỳnh Lưu'
      ]
      
      sheetList = knownSheets.map((title, index) => ({
        title,
        sheetId: index,
      }))
    }
    
    // Lọc bỏ các sheet trống hoặc không có tên
    const filteredSheetList = sheetList.filter(sheet => sheet.title && sheet.title.trim() !== '')

    // Disable caching để đảm bảo luôn lấy danh sách sheet mới nhất
    return NextResponse.json(
      { sheets: filteredSheetList },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
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
