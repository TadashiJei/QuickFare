// In your Next.js app, create a new file: lib/websocket.js
import { useEffect, useState } from 'react'

export function useWebSocket(url) {
  const [data, setData] = useState(null)

  useEffect(() => {
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      setData(JSON.parse(event.data))
    }

    return () => {
      
      ws.close()
    }
  }, [url])

  return data
}