import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useNavigate } from 'react-router-dom'
import { showToast } from '../components/Toast.jsx'

export default function ResetPassword() {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [ready, setReady] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const save = async () => {
    if (!ready) return showToast('Abre esta página desde el enlace del correo')
    if (!pw1 || pw1.length < 8) return showToast('Contraseña muy corta')
    if (pw1 !== pw2) return showToast('Las contraseñas no coinciden')
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    if (error) return showToast('No se pudo cambiar la contraseña')
    showToast('Contraseña actualizada')
    nav('/login')
  }

  return (
    <div className="form">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cambiar contraseña</h2>
        <div className="small">Esta pantalla funciona desde el enlace que llega al correo.</div>
        <div className="space" />
        <div className="label">Nueva contraseña</div>
        <input className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
        <div className="space" />
        <div className="label">Confirmar contraseña</div>
        <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div className="space" />
        <button className="btn btnPrimary" style={{ width: '100%' }} onClick={save}>Guardar</button>
      </div>
    </div>
  )
}
