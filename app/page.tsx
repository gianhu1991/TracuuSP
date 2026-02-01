'use client'

import { useState, useEffect } from 'react'

interface SearchResult {
  olt: string
  slot: string
  port: string
  hop: string
  dayNhay: string
  spliterCap1: string
  cap: string
  spliterCap2: string
  spliterCap2Name: string
  trangThai: string
}

interface Sheet {
  title: string
  sheetId: number
}

export default function Home() {
  const [olt, setOlt] = useState('')
  const [slot, setSlot] = useState('')
  const [port, setPort] = useState('')
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [ports, setPorts] = useState<string[]>([])
  const [loadingSheets, setLoadingSheets] = useState(true)
  const [loadingSlotsPorts, setLoadingSlotsPorts] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Load danh sách sheet khi component mount
  useEffect(() => {
    fetchSheets()
  }, [])

  const fetchSheets = async () => {
    setLoadingSheets(true)
    try {
      // Thêm cache-busting để tránh cache
      const response = await fetch(`/api/sheets?t=${Date.now()}`)
      const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Không thể tải danh sách OLT')
        }
        
        setSheets(data.sheets || [])
        setError('') // Clear error nếu thành công
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải danh sách OLT'
        setError(errorMessage)
        console.error('Error loading sheets:', err)
      } finally {
        setLoadingSheets(false)
      }
  }

  // Load danh sách Slot và Port khi chọn OLT
  useEffect(() => {
    const fetchSlotsPorts = async () => {
      if (!olt) {
        setSlots([])
        setPorts([])
        setSlot('')
        setPort('')
        return
      }

      setLoadingSlotsPorts(true)
      setSlot('')
      setPort('')
      
      try {
        const response = await fetch('/api/slots-ports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ olt }),
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Không thể tải danh sách Slot và Port')
        }
        
        setSlots(data.slots || [])
        setPorts(data.ports || [])
        
        // Nếu có warning, hiển thị nhưng không coi là lỗi
        if (data.warning) {
          console.warn(data.warning)
          // Không set error, chỉ log warning
        } else {
          setError('')
        }
      } catch (err) {
        // Nếu lỗi, vẫn cho phép nhập thủ công
        const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải danh sách Slot và Port'
        // Không set error để không chặn người dùng nhập thủ công
        console.warn('Warning loading slots/ports:', errorMessage)
        setSlots([])
        setPorts([])
      } finally {
        setLoadingSlotsPorts(false)
      }
    }
    
    fetchSlotsPorts()
  }, [olt])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!olt || !slot || !port) {
      setError('Vui lòng nhập đầy đủ thông tin OLT, Slot và Port')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ olt, slot, port }),
      })

      if (!response.ok) {
        throw new Error('Có lỗi xảy ra khi tra cứu')
      }

      const data = await response.json()
      setResults(data.results || [])
      setDebugInfo(data.debug || null)
      
      // Hiển thị debug info trong console
      if (data.debug) {
        console.log('🔍 Debug Info:', data.debug)
        if (data.debug.warning) {
          console.warn('⚠️ Warning:', data.debug.warning)
        }
      }
      
      if (data.results && data.results.length === 0) {
        // Hiển thị thông tin debug chi tiết hơn
        let errorMsg = 'Không tìm thấy kết quả nào'
        if (data.debug) {
          if (data.debug.totalMatchedRows === 0) {
            errorMsg = `Không tìm thấy dòng nào khớp với OLT: "${olt}", Slot: "${slot}", Port: "${port}"`
          } else if (data.debug.rowsWithDaVe === 0) {
            errorMsg = `Tìm thấy ${data.debug.totalMatchedRows} dòng khớp nhưng không có dòng nào có trạng thái "Đã vẽ"`
          } else {
            errorMsg = `Tìm thấy ${data.debug.totalMatchedRows} dòng khớp, ${data.debug.rowsWithDaVe} dòng có "Đã vẽ" nhưng không có tên Spliter cấp 2`
          }
        }
        setError(errorMsg)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Module tra cứu Spliter cấp 2</h1>
        <p className="subtitle">Hệ thống tra cứu thông tin Spliter cấp 2 theo OLT, Slot và Port</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="form-group">
          <label htmlFor="olt">OLT:</label>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <select
              id="olt"
              value={olt}
              onChange={(e) => setOlt(e.target.value)}
              required
              disabled={loadingSheets}
              style={{ flex: 1 }}
            >
              <option value="">-- Chọn OLT --</option>
              {sheets.map((sheet) => (
                <option key={sheet.sheetId} value={sheet.title}>
                  {sheet.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchSheets}
              disabled={loadingSheets}
              style={{ 
                padding: '8px 12px', 
                background: '#6c5ce7', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: loadingSheets ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
              title="Làm mới danh sách OLT"
            >
              {loadingSheets ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="slot">Slot:</label>
          {slots.length > 0 ? (
            <select
              id="slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              required
              disabled={!olt || loadingSlotsPorts}
            >
              <option value="">-- Chọn Slot --</option>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="slot"
              type="text"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              placeholder="Nhập Slot (ví dụ: 3)"
              required
              disabled={!olt || loadingSlotsPorts}
            />
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="port">Port:</label>
          {ports.length > 0 ? (
            <select
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              required
              disabled={!olt || loadingSlotsPorts}
            >
              <option value="">-- Chọn Port --</option>
              {ports.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="port"
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="Nhập Port (ví dụ: 0)"
              required
              disabled={!olt || loadingSlotsPorts}
            />
          )}
        </div>
        
        <button type="submit" className="search-button" disabled={loading}>
          {loading ? 'Đang tìm...' : 'Tra cứu'}
        </button>
      </form>

      {error && (
        <div className="error">
          {error}
          {error.includes('danh sách OLT') && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              Vui lòng kiểm tra: Google Sheet đã được chia sẻ với Service Account chưa? 
              (Email: tracuusp-service@tracuusp.iam.gserviceaccount.com)
            </div>
          )}
          {debugInfo && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
              <button 
                onClick={() => setShowDebug(!showDebug)}
                style={{ marginBottom: '10px', padding: '5px 10px', cursor: 'pointer' }}
              >
                {showDebug ? 'Ẩn' : 'Hiển thị'} Debug Info
              </button>
              {showDebug && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {loading && <div className="loading">Đang tải dữ liệu...</div>}

      {!loading && results.length > 0 && (
        <div className="results-container">
          <h2>Kết quả tra cứu ({results.length} Spliter cấp 2)</h2>
          <table className="results-table">
            <thead>
              <tr>
                <th>Danh sách S2 tìm thấy</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => {
                const copyToClipboard = (text: string) => {
                  navigator.clipboard.writeText(text).then(() => {
                    // Hiển thị thông báo đã copy (có thể thêm toast notification)
                    alert(`Đã copy: ${text}`)
                  }).catch(err => {
                    console.error('Failed to copy:', err)
                    // Fallback cho trình duyệt cũ
                    const textArea = document.createElement('textarea')
                    textArea.value = text
                    document.body.appendChild(textArea)
                    textArea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textArea)
                    alert(`Đã copy: ${text}`)
                  })
                }
                
                return (
                  <tr key={index}>
                    <td>{result.spliterCap2Name}</td>
                    <td>
                      <button
                        onClick={() => copyToClipboard(result.spliterCap2Name)}
                        className="copy-button"
                        title="Copy tên S2"
                      >
                        📋 Copy
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="no-results">
          Nhập thông tin OLT, Slot và Port để tra cứu
        </div>
      )}
    </div>
  )
}
