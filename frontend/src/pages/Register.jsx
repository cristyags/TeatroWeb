import { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useNavigate, Link } from 'react-router-dom'
import { showToast } from '../components/Toast.jsx'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    const cleanName = fullName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanName || cleanName.length < 3) return showToast('Escribe tu nombre completo con al menos 3 caracteres')
    if (!isValidEmail(cleanEmail)) return showToast('El correo debe tener un formato válido, por ejemplo nombre@correo.com')
    if (!password || password.length < 8) return showToast('La contraseña debe tener mínimo 8 caracteres')

    setSending(true)
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/login`,
        data: { full_name: cleanName }
      }
    })
    setSending(false)

    if (error) {
      const msg = String(error.message || '')
      if (msg.toLowerCase().includes('password')) return showToast('La contraseña no cumple la política mínima de seguridad')
      if (msg.toLowerCase().includes('email')) return showToast('Ese correo no es válido o ya fue registrado')
      return showToast('No se pudo crear la cuenta en este momento')
    }

    if (data?.user?.id) {
      await supabase.from('profiles').upsert({ id: data.user.id, email: cleanEmail, full_name: cleanName, role: 'CLIENTE' })
    }

    showToast('Cuenta creada. Revisa tu correo si Supabase te pidió confirmación.')
    nav('/login')
  }

  return (
    <div className="form">
      <div className="card shellCard">
        <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>
        <p className="small">Usa un correo válido y una contraseña de al menos 8 caracteres.</p>
        <form onSubmit={submit}>
          <div className="space" />
          <div className="label">Nombre completo</div>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre completo" />
          <div className="space" />
          <div className="label">Correo</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          <div className="space" />
          <div className="label">Contraseña</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          <div className="space" />
          <button className="btn btnPrimary" disabled={sending} style={{ width: '100%' }}>
            {sending ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        <div className="space" />
        <div className="small">
          ¿Ya tienes cuenta? <Link to="/login" style={{ textDecoration: 'underline' }}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}
