'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Mail, User, LogIn, ShieldCheck, AlertCircle, CheckCircle, UserPlus, Eye, EyeOff } from 'lucide-react'
import { validarNombre, validarEmail, validarPassword } from '@/lib/validacionesUsuario'

export default function LoginPage() {
  const [modoSetup, setModoSetup] = useState(false)
  const [modoRegistro, setModoRegistro] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    fetch('/api/auth/setup')
      .then((r) => r.json())
      .then((d) => setModoSetup(!!d.necesitaSetup))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const cambiarModo = (registro: boolean) => {
    setModoRegistro(registro)
    setError('')
    setAviso('')
    setPassword('')
    setConfirmar('')
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAviso('')

    if (modoSetup || modoRegistro) {
      const msg = validarNombre(nombre) || validarEmail(email) || validarPassword(password)
      if (msg) return setError(msg)
      if (modoRegistro && password !== confirmar) return setError('Las contraseñas no coinciden.')
    } else if (!email.trim() || !password) {
      return setError('Ingresa tu correo y contraseña.')
    }

    setEnviando(true)
    try {
      // Solicitud de cuenta de profesor: queda pendiente hasta que un administrador la apruebe
      if (modoRegistro) {
        const r = await fetch('/api/auth/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email, password }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo enviar la solicitud.')
        setModoRegistro(false)
        setNombre('')
        setPassword('')
        setConfirmar('')
        setAviso('Solicitud enviada. Un administrador debe aprobar tu cuenta antes de que puedas iniciar sesión.')
        setEnviando(false)
        return
      }

      if (modoSetup) {
        const r = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email, password }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo crear el superadmin.')
      }
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo iniciar sesión.')
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message)
      setEnviando(false)
    }
  }

  const inputBase =
    'w-full bg-[#272839] border border-[#313248] rounded-xl pl-10 pr-3 py-3 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8] transition-colors'

  const pideNombre = modoSetup || modoRegistro
  const titulo = modoSetup ? 'Configuración inicial' : modoRegistro ? 'Crear cuenta' : 'Planificador de Evaluaciones'
  const subtitulo = modoSetup
    ? 'Crea la cuenta del superadmin para comenzar.'
    : modoRegistro
    ? 'Solicita tu cuenta de profesor. Un administrador la aprobará.'
    : 'Inicia sesión para continuar.'

  return (
    <div className="min-h-screen bg-[#161722] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-[#1d1e2e] border border-[#313248] rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#818cf8]/10 border border-[#818cf8]/20 flex items-center justify-center mb-3">
            {modoSetup ? <ShieldCheck className="w-7 h-7 text-[#818cf8]" /> : modoRegistro ? <UserPlus className="w-7 h-7 text-[#818cf8]" /> : <Lock className="w-7 h-7 text-[#818cf8]" />}
          </div>
          <h1 className="text-xl font-semibold text-[#e0e0ec]">{titulo}</h1>
          <p className="text-sm text-[#8a8b9e] mt-1 text-center">{subtitulo}</p>
        </div>

        {cargando ? (
          <div className="text-center text-sm text-[#8a8b9e] py-6">Cargando...</div>
        ) : (
          <>
            <form onSubmit={enviar} className="space-y-4" noValidate>
              {pideNombre && (
                <div className="relative">
                  <User className="w-4 h-4 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className={inputBase} autoComplete="name" />
                </div>
              )}
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className={inputBase} autoComplete="email" />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={pideNombre ? 'Contraseña (mín. 8, letras y números)' : 'Contraseña'}
                  className={`${inputBase} pr-10`}
                  autoComplete={pideNombre ? 'new-password' : 'current-password'}
                />
                <button type="button" onClick={() => setVerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a6b7e] hover:text-[#b0b0c4]" tabIndex={-1}>
                  {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {modoRegistro && (
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Confirmar contraseña"
                    className={inputBase}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <AnimatePresence>
                {aviso && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-emerald-400 text-xs flex items-start gap-1.5 overflow-hidden"
                  >
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{aviso}</span>
                  </motion.p>
                )}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-400 text-xs flex items-start gap-1.5 overflow-hidden"
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={enviando}
                className="w-full py-3 bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white font-semibold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {modoRegistro ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {enviando ? 'Procesando...' : modoSetup ? 'Crear superadmin y entrar' : modoRegistro ? 'Solicitar cuenta' : 'Iniciar sesión'}
              </motion.button>
            </form>

            {!modoSetup && (
              <p className="text-center text-xs text-[#8a8b9e] mt-5">
                {modoRegistro ? (
                  <>¿Ya tienes cuenta?{' '}<button type="button" onClick={() => cambiarModo(false)} className="text-[#a5b4fc] hover:text-[#c7d2fe] font-medium">Iniciar sesión</button></>
                ) : (
                  <>¿Eres profesor y aún no tienes cuenta?{' '}<button type="button" onClick={() => cambiarModo(true)} className="text-[#a5b4fc] hover:text-[#c7d2fe] font-medium">Crear cuenta</button></>
                )}
              </p>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
