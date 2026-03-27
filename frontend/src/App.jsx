import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import FunctionDetail from './pages/FunctionDetail.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import MyTickets from './pages/MyTickets.jsx'
import Admin from './pages/Admin.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Account from './pages/Account.jsx'
import Protected from './components/Protected.jsx'
import AdminOnly from './components/AdminOnly.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  return (
    <div className="container">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/obra/:id" element={<FunctionDetail />} />
        <Route path="/funcion/:id" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/mis-tickets" element={<Protected><MyTickets /></Protected>} />
        <Route path="/cuenta" element={<Protected><Account /></Protected>} />
        <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </div>
  )
}
