import { useEffect, useState } from 'react'

export function showToast(message) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message } }))
}

export default function Toast() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const onToast = (e) => {
      setMsg(e.detail?.message || '')
      if (e.detail?.message) setTimeout(() => setMsg(''), 3200)
    }
    window.addEventListener('app-toast', onToast)
    return () => window.removeEventListener('app-toast', onToast)
  }, [])
  if (!msg) return null
  return <div className="toast">{msg}</div>
}
