import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { olt, slot, port } = await request.json()

    if (!olt || !slot || !port) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin OLT, Slot và Port' },
        { status: 400 }
      )
    }

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

    // Đọc dữ liệu từ sheet cụ thể (tên sheet = tên OLT)
    // Sử dụng tên sheet làm range
    const sheetName = olt.trim()
    
    let response
    try {
      // Thử đọc với dấu nháy đơn
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:J`, // Đọc từ cột A đến J trong sheet có tên = OLT
      })
    } catch (rangeError: any) {
      // Nếu lỗi "not supported" hoặc "Unable to parse", thử không có dấu nháy
      if (rangeError.message?.includes('not supported') || rangeError.message?.includes('Unable to parse range')) {
        try {
          response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:J`,
          })
        } catch (e2: any) {
          // Nếu vẫn lỗi, trả về kết quả rỗng
          console.error(`Cannot read sheet "${sheetName}":`, e2.message)
          return NextResponse.json({ results: [] })
        }
      } else {
        throw rangeError
      }
    }

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Lấy header (hàng đầu tiên)
    const headers = rows[0]
    
    // Tìm index của các cột
    const oltIndex = headers.findIndex((h: string) => h && h.toLowerCase().includes('olt'))
    const slotIndex = headers.findIndex((h: string) => h && h.toLowerCase().includes('slot'))
    const portIndex = headers.findIndex((h: string) => h && h.toLowerCase().includes('port'))
    const hopIndex = headers.findIndex((h: string) => h && h.toLowerCase().includes('hộp'))
    const dayNhayIndex = headers.findIndex((h: string) => h && (h.toLowerCase().includes('dây nhảy') || h.toLowerCase().includes('daynhay') || h.toLowerCase().includes('nhảy')))
    const spliterCap1Index = headers.findIndex((h: string) => h && (h.toLowerCase().includes('spliter cấp 1') || h.toLowerCase().includes('spliter cap 1')))
    const capIndex = headers.findIndex((h: string) => h && (h.toLowerCase().includes('cáp') || h.toLowerCase().includes('cap')))
    const spliterCap2Index = headers.findIndex((h: string) => h && (h.toLowerCase().includes('spliter cấp 2') || h.toLowerCase().includes('spliter cap 2')))
    let trangThaiIndex = headers.findIndex((h: string) => h && (h.toLowerCase().includes('trạng thái') || h.toLowerCase().includes('trang thai')))

    // Fallback: Nếu không tìm thấy bằng tên, dùng index cố định
    // Cột I (index 8) là "Spliter cấp 2", Cột K (index 10) là "Trạng thái"
    if (trangThaiIndex === -1 && headers.length > 10) {
      trangThaiIndex = 10 // Cột K
    }

    // Xử lý cột Spliter cấp 2 (cột I = index 8)
    // Ưu tiên tìm bằng tên, nếu không có thì dùng index 8
    let spliterCap2NameIndex = -1
    if (spliterCap2Index !== -1) {
      // Tìm cột tiếp theo có chứa "spliter cấp 2"
      for (let i = spliterCap2Index + 1; i < headers.length; i++) {
        if (headers[i] && (headers[i].toLowerCase().includes('spliter cấp 2') || headers[i].toLowerCase().includes('spliter cap 2'))) {
          spliterCap2NameIndex = i
          break
        }
      }
      // Nếu không tìm thấy cột thứ 2, dùng cột đầu tiên (cột H)
      if (spliterCap2NameIndex === -1) {
        spliterCap2NameIndex = spliterCap2Index
      }
    }
    
    // Fallback: Nếu không tìm thấy bằng tên, dùng index 8 (cột I)
    if (spliterCap2NameIndex === -1 && headers.length > 8) {
      spliterCap2NameIndex = 8 // Cột I
    }
    
    // Debug: Log request parameters và column indexes
    console.log('=== SEARCH REQUEST ===')
    console.log('Search params:', { olt, slot, port, sheetName: olt })
    console.log('Total rows:', rows.length)
    console.log('Column indexes:', {
      oltIndex,
      slotIndex,
      portIndex,
      spliterCap2Index,
      spliterCap2NameIndex,
      trangThaiIndex,
      headers: headers.map((h: string, i: number) => `${i}: ${h || '(empty)'}`)
    })
    console.log('First 3 data rows:', rows.slice(1, 4).map((row: any[], idx: number) => ({
      rowIndex: idx + 1,
      olt: row[oltIndex],
      slot: row[slotIndex],
      port: row[portIndex],
      spliterCap2: row[spliterCap2NameIndex] || row[spliterCap2Index] || row[8],
      trangThai: row[trangThaiIndex] || row[10],
      fullRow: row.slice(0, 12)
    })))

    // Lọc dữ liệu theo OLT, Slot, Port
    const results: any[] = []
    let matchedRowsCount = 0
    let filteredByStatusCount = 0
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      
      // Xử lý merged cells - nếu cell trống, lấy giá trị từ hàng trước
      let currentOlt = row[oltIndex] || ''
      let currentSlot = row[slotIndex] || ''
      let currentPort = row[portIndex] || ''
      
      // Nếu cell trống, tìm giá trị từ các hàng trước
      if (!currentOlt && i > 1) {
        for (let j = i - 1; j >= 1; j--) {
          if (rows[j][oltIndex]) {
            currentOlt = rows[j][oltIndex]
            break
          }
        }
      }
      
      if (!currentSlot && i > 1) {
        for (let j = i - 1; j >= 1; j--) {
          if (rows[j][slotIndex]) {
            currentSlot = rows[j][slotIndex]
            break
          }
        }
      }
      
      if (!currentPort && i > 1) {
        for (let j = i - 1; j >= 1; j--) {
          if (rows[j][portIndex]) {
            currentPort = rows[j][portIndex]
            break
          }
        }
      }

      // So sánh (không phân biệt hoa thường và loại bỏ khoảng trắng)
      const normalizedOlt = currentOlt.toString().trim().toLowerCase()
      const normalizedSlot = currentSlot.toString().trim().toLowerCase()
      const normalizedPort = currentPort.toString().trim().toLowerCase()
      
      const searchOlt = olt.trim().toLowerCase()
      const searchSlot = slot.trim().toLowerCase()
      const searchPort = port.trim().toLowerCase()

      if (
        normalizedOlt === searchOlt &&
        normalizedSlot === searchSlot &&
        normalizedPort === searchPort
      ) {
        matchedRowsCount++
        
        // Chỉ thêm nếu có Spliter cấp 2 (cột I = index 8) và trạng thái là "Đã vẽ" (cột K = index 10)
        const trangThai = (trangThaiIndex !== -1 && row[trangThaiIndex] ? row[trangThaiIndex] : '').toString().trim()
        
        // Ưu tiên lấy từ cột I (index 8 hoặc spliterCap2NameIndex)
        let spliterCap2Name = ''
        if (spliterCap2NameIndex !== -1 && row[spliterCap2NameIndex]) {
          spliterCap2Name = row[spliterCap2NameIndex].toString().trim()
        } else if (spliterCap2Index !== -1 && row[spliterCap2Index]) {
          spliterCap2Name = row[spliterCap2Index].toString().trim()
        } else if (row[8]) {
          // Fallback: dùng index 8 trực tiếp (cột I)
          spliterCap2Name = row[8].toString().trim()
        }
        
        // Chỉ lấy kết quả có trạng thái "Đã vẽ" và có tên Spliter cấp 2
        // So sánh linh hoạt hơn (trim và không phân biệt hoa thường)
        const isDaVe = trangThai.toLowerCase().includes('đã vẽ') || trangThai.toLowerCase().includes('da ve')
        
        // Debug log cho TẤT CẢ các dòng khớp OLT/Slot/Port
        console.log(`[Row ${i}] Matched OLT/Slot/Port:`, {
          rowIndex: i,
          olt: currentOlt,
          slot: currentSlot,
          port: currentPort,
          spliterCap2Name: spliterCap2Name || '(empty)',
          trangThai: trangThai || '(empty)',
          isDaVe,
          spliterCap2NameIndex,
          trangThaiIndex,
          rowIndex8: row[8] || '(empty)',
          rowIndex10: row[10] || '(empty)',
          willAddToResults: isDaVe && spliterCap2Name ? 'YES' : 'NO',
          reason: !isDaVe ? 'Status is not "Đã vẽ"' : !spliterCap2Name ? 'No Spliter cấp 2 name' : 'OK'
        })
        
        if (isDaVe && spliterCap2Name) {
          filteredByStatusCount++
          results.push({
            olt: currentOlt,
            slot: currentSlot,
            port: currentPort,
            hop: row[hopIndex] || '',
            dayNhay: row[dayNhayIndex] || '',
            spliterCap1: row[spliterCap1Index] || '',
            cap: row[capIndex] || '',
            spliterCap2: row[spliterCap2Index] || '',
            spliterCap2Name: spliterCap2Name,
            trangThai: trangThai,
          })
        }
      }
    }

    console.log('=== SEARCH RESULTS ===')
    console.log(`Total matched rows (OLT/Slot/Port): ${matchedRowsCount}`)
    console.log(`Rows with "Đã vẽ" status: ${filteredByStatusCount}`)
    console.log(`Final results count: ${results.length}`)
    if (matchedRowsCount > 0 && results.length === 0) {
      console.log('WARNING: Found matching rows but no results returned. Check status filtering logic.')
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Error searching:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    let errorMessage = 'Có lỗi xảy ra khi tra cứu dữ liệu'
    
    if (error.message?.includes('not supported for this document')) {
      errorMessage = 'File Excel được upload không hỗ trợ đọc qua Google Sheets API. Vui lòng chuyển đổi file sang Google Sheets format thực sự (File > Import > Upload file Excel).'
    } else if (error.message?.includes('PERMISSION_DENIED')) {
      errorMessage = 'Không có quyền truy cập. Vui lòng chia sẻ Sheet với Service Account.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
