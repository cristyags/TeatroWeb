import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { showToast } from '../components/Toast.jsx'

export default function Account() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      setEmail(u?.email || '')
      if (u?.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', u.id).maybeSingle()
        setRole(profile?.role || '')
      }
    }
    load()
  }, [])

  const changePassword = async () => {
    if (!pw1 || pw1.length < 8) return showToast('La nueva contraseña debe tener mínimo 8 caracteres')
    if (pw1 !== pw2) return showToast('Las contraseñas no coinciden, revisa ambas casillas')
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    if (error) return showToast('No se pudo cambiar la contraseña')
    setPw1('')
    setPw2('')
    showToast('Contraseña actualizada correctamente')
  }

  return (
    <div className="form">
      <div className="card shellCard">
        <h2 style={{ marginTop: 0 }}>Cuenta</h2>
        <div className="row">
          <span className="tag">{email}</span>
          <span className="tag">Rol: {role || 'CLIENTE'}</span>
        </div>

        <div className="hr" />

        <h3 style={{ margin: 0 }}>Cambiar contraseña</h3>
        <div className="space" />
        <div className="label">Nueva contraseña</div>
        <input className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
        <div className="space" />
        <div className="label">Confirmar contraseña</div>
        <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div className="space" />
        <button className="btn btnPrimary" style={{ width: '100%' }} onClick={changePassword}>Guardar nueva contraseña</button>
        <div className="space" />
        <div className="small">También puedes usar el botón “Olvidé mi contraseña” desde la pantalla de login.</div>
      </div>
    </div>
  )
}
