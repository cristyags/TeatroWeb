import { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useNavigate, Link } from 'react-router-dom'
import { showToast } from '../components/Toast.jsx'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) return showToast('Escribe un correo válido para iniciar sesión')
    if (!password) return showToast('Escribe tu contraseña')

    setSending(true)
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    setSending(false)
    if (error) return showToast('Correo o contraseña incorrectos')
    showToast('Bienvenida a la cartelera')
    nav('/')
  }

  const forgot = async () => {
    const cleanEmail = resetEmail.trim().toLowerCase()
    if (!isValidEmail(cleanEmail)) return showToast('Escribe un correo válido para recuperar tu contraseña')
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: `${siteUrl}/reset` })
    if (error) return showToast('No se pudo enviar el correo de recuperación')
    showToast('Te enviamos un correo para cambiar tu contraseña')
  }

  return (
    <div className="form">
      <div className="card shellCard">
        <h2 style={{ marginTop: 0 }}>Entrar</h2>
        <form onSubmit={submit}>
          <div className="space" />
          <div className="label">Correo</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          <div className="space" />
          <div className="label">Contraseña</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <div className="space" />
          <button className="btn btnPrimary" disabled={sending} style={{ width: '100%' }}>
            {sending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="hr" />

        <div className="label">Olvidé mi contraseña</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <input className="input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="tu@correo.com" />
          <button className="btn" onClick={forgot}>Enviar</button>
        </div>

        <div className="space" />
        <div className="small">
          ¿No tienes cuenta? <Link to="/register" style={{ textDecoration: 'underline' }}>Crear cuenta</Link>
        </div>
      </div>
    </div>
  )
}
