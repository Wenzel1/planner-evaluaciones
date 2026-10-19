'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Mail, User, LogIn, ShieldCheck, AlertCircle, CheckCircle, UserPlus, Eye, EyeOff,
  Phone, CreditCard, KeyRound, ArrowLeft, Sparkles, FileText, Users, Info,
} from 'lucide-react'
import { validarNombre, validarEmail, validarPassword, validarTelefono, validarCedula } from '@/lib/validacionesUsuario'

type Modo = 'login' | 'registro' | 'recuperar'

// Medidor visual de seguridad (la regla real del sistema es: mínimo 8 caracteres con letras y números)
function fuerza(p: string): { nivel: number; texto: string; color: string } {
  if (!p) return { nivel: 0, texto: '', color: 'bg-[#313248]' }
  let n = 0
  if (p.length >= 8) n++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++
  if (/\d/.test(p) && /[A-Za-z]/.test(p)) n++
  if (p.length >= 12 || /[^A-Za-z0-9]/.test(p)) n++
  const tabla = [
    { texto: 'Muy débil', color: 'bg-red-500' },
    { texto: 'Débil', color: 'bg-orange-500' },
    { texto: 'Aceptable', color: 'bg-yellow-500' },
    { texto: 'Buena', color: 'bg-lime-500' },
    { texto: 'Fuerte', color: 'bg-emerald-500' },
  ]
  return { nivel: n, ...tabla[n] }
}

export default function LoginPage() {
  const [modoSetup, setModoSetup] = useState(false)
  const [modo, setModo] = useState<Modo>('login')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [verPassword, setVerPassword] = useState(false)
  const [mayusculas, setMayusculas] = useState(false)

  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [sacudir, setSacudir] = useState(0)
  const [recuperacionEnviada, setRecuperacionEnviada] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sesion') === 'expirada') {
      setAviso('Tu sesión expiró o se cerró. Inicia sesión de nuevo para continuar.')
    }
    fetch('/api/auth/setup')
      .then((r) => r.json())
      .then((d) => setModoSetup(!!d.necesitaSetup))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const fallar = (msg: string) => { setError(msg); setSacudir((n) => n + 1) }

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    setError(''); setAviso(''); setPassword(''); setConfirmar(''); setRecuperacionEnviada('')
  }

  const revisarMayusculas = (e: React.KeyboardEvent) => setMayusculas(e.getModifierState && e.getModifierState('CapsLock'))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setAviso('')

    // ---- validación en el navegador (el servidor vuelve a validar todo) ----
    if (modo === 'recuperar') {
      const m = validarEmail(email)
      if (m) return fallar(m)
    } else if (modo === 'registro') {
      const msg = validarNombre(nombre) || validarCedula(cedula) || validarTelefono(telefono) || validarEmail(email) || validarPassword(password)
      if (msg) return fallar(msg)
      if (password !== confirmar) return fallar('Las contraseñas no coinciden.')
      if (!acepta) return fallar('Debes aceptar el tratamiento de tus datos personales para solicitar la cuenta.')
    } else if (modoSetup) {
      const msg = validarNombre(nombre) || validarEmail(email) || validarPassword(password)
      if (msg) return fallar(msg)
    } else if (!email.trim() || !password) {
      return fallar('Ingresa tu correo y tu contraseña.')
    }

    setEnviando(true)
    try {
      if (modo === 'recuperar') {
        const r = await fetch('/api/auth/recuperar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo enviar la solicitud.')
        setRecuperacionEnviada(d.mensaje)
        return
      }

      if (modo === 'registro') {
        const r = await fetch('/api/auth/registro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, cedula, telefono, email, password, aceptaTratamiento: acepta }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo enviar la solicitud.')
        setModo('login'); setNombre(''); setCedula(''); setTelefono(''); setPassword(''); setConfirmar(''); setAcepta(false)
        setAviso('Solicitud enviada. Un administrador debe aprobar tu cuenta antes de que puedas iniciar sesión.')
        return
      }

      if (modoSetup) {
        const r = await fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, password }) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'No se pudo crear el superadmin.')
      }

      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo iniciar sesión.')
      window.location.href = '/'
      return // se queda en "Procesando..." mientras la página cambia
    } catch (err: any) {
      fallar(err instanceof TypeError ? 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' : err.message)
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'w-full bg-[#1b1c2b] border border-[#313248] rounded-xl pl-10 pr-3 py-3 text-sm text-[#e0e0ec] placeholder-[#5f6074] focus:outline-none focus:border-[#818cf8] focus:ring-2 focus:ring-[#818cf8]/20 transition-all'
  const etiqueta = 'text-[11px] font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5'
  const icono = 'w-4 h-4 text-[#5f6074] absolute left-3 top-1/2 -translate-y-1/2'
  const pideRegistro = modo === 'registro'
  const f = fuerza(password)

  const titulo = modoSetup ? 'Configuración inicial' : modo === 'registro' ? 'Crea tu cuenta de profesor' : modo === 'recuperar' ? 'Recuperar contraseña' : 'Bienvenido de nuevo'
  const subtitulo = modoSetup
    ? 'Crea la cuenta del superadmin para comenzar.'
    : modo === 'registro' ? 'Un administrador revisará y aprobará tu solicitud.'
    : modo === 'recuperar' ? 'Escribe tu correo. El superadmin te contactará por teléfono con una clave temporal.'
    : 'Inicia sesión para continuar con tu planificación.'

  return (
    <div className="min-h-screen bg-[#12131d] flex">
      {/* ---------- Panel de marca (solo en pantallas grandes) ---------- */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-[#1a1b3a] via-[#1d1e2e] to-[#14151f]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#818cf8]/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#818cf8]/15 border border-[#818cf8]/30 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-[#a5b4fc]" /></div>
          <span className="text-lg font-semibold text-[#e0e0ec]">Planificador de Evaluaciones</span>
        </div>
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">Planifica, evalúa y organiza tus cursos en un solo lugar.</h2>
            <p className="text-[#9a9bb0] mt-3">Una herramienta pensada para profesores, con apoyo de un agente de inteligencia artificial.</p>
          </div>
          <ul className="space-y-4">
            {[
              { i: Sparkles, t: 'Un agente de IA que propone y organiza tus evaluaciones.' },
              { i: FileText, t: 'Planes de acción listos para compartir en PDF.' },
              { i: Users, t: 'Tus secciones y estudiantes, ordenados y separados de los de otros profesores.' },
            ].map(({ i: Icono, t }) => (
              <li key={t} className="flex items-start gap-3 text-sm text-[#c0c0d0]">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"><Icono className="w-4 h-4 text-[#a5b4fc]" /></span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#6a6b7e]">Acceso protegido: contraseñas cifradas, sesiones firmadas y registro de actividad.</p>
      </div>

      {/* ---------- Formulario ---------- */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-6">
            <div className="w-9 h-9 rounded-lg bg-[#818cf8]/15 border border-[#818cf8]/30 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#a5b4fc]" /></div>
            <span className="font-semibold text-[#e0e0ec]">Planificador de Evaluaciones</span>
          </div>

          <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Pestañas Iniciar sesión / Crear cuenta */}
            {!cargando && !modoSetup && modo !== 'recuperar' && (
              <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-[#161722] border border-[#282a3f] rounded-xl">
                {([['login', 'Iniciar sesión', LogIn], ['registro', 'Crear cuenta', UserPlus]] as const).map(([id, texto, Icono]) => (
                  <button key={id} type="button" onClick={() => cambiarModo(id)} className={`relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${modo === id ? 'text-white' : 'text-[#8a8b9e] hover:text-[#b0b0c4]'}`}>
                    {modo === id && <motion.span layoutId="pill-login-modo" className="absolute inset-0 bg-[#818cf8]/20 border border-[#818cf8]/30 rounded-lg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    <Icono className="relative z-10 w-4 h-4" /><span className="relative z-10">{texto}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mb-6">
              <h1 className="text-xl font-semibold text-[#e0e0ec]">{titulo}</h1>
              <p className="text-sm text-[#8a8b9e] mt-1">{subtitulo}</p>
            </div>

            {cargando ? (
              <div className="text-center text-sm text-[#8a8b9e] py-10">Cargando...</div>
            ) : recuperacionEnviada ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-200">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><p>{recuperacionEnviada}</p>
                </div>
                <p className="text-xs text-[#8a8b9e]">Si no recibes la llamada o el mensaje, comunícate directamente con el superadmin del sistema.</p>
                <button type="button" onClick={() => cambiarModo('login')} className="w-full py-3 text-sm font-medium text-[#c7d2fe] bg-[#272839] border border-[#313248] rounded-xl hover:bg-[#2c2d40] flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Volver a iniciar sesión</button>
              </div>
            ) : (
              <motion.form key={`${modo}-${sacudir}`} animate={sacudir ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }} onSubmit={enviar} className="space-y-4" noValidate>
                {(pideRegistro || modoSetup) && (
                  <div>
                    <label className={etiqueta}>Nombre completo</label>
                    <div className="relative"><User className={icono} /><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ana María Pérez" className={campo} autoComplete="name" autoFocus /></div>
                  </div>
                )}

                {pideRegistro && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={etiqueta}>Cédula</label>
                      <div className="relative"><CreditCard className={icono} /><input inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Solo números" className={campo} autoComplete="off" /></div>
                    </div>
                    <div>
                      <label className={etiqueta}>Teléfono</label>
                      <div className="relative"><Phone className={icono} /><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 300 123 4567" className={campo} autoComplete="tel" /></div>
                    </div>
                  </div>
                )}

                <div>
                  <label className={etiqueta}>Correo electrónico</label>
                  <div className="relative"><Mail className={icono} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={campo} autoComplete="email" autoFocus={modo === 'login' || modo === 'recuperar'} /></div>
                </div>

                {modo !== 'recuperar' && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={etiqueta}>Contraseña</label>
                      {modo === 'login' && !modoSetup && (
                        <button type="button" onClick={() => cambiarModo('recuperar')} className="text-[11px] text-[#a5b4fc] hover:text-[#c7d2fe] mb-1.5">¿Olvidaste tu contraseña?</button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className={icono} />
                      <input
                        type={verPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={revisarMayusculas} onKeyDown={revisarMayusculas} onBlur={() => setMayusculas(false)}
                        placeholder={pideRegistro || modoSetup ? 'Mínimo 8, con letras y números' : 'Tu contraseña'} className={`${campo} pr-10`}
                        autoComplete={pideRegistro || modoSetup ? 'new-password' : 'current-password'}
                      />
                      <button type="button" onClick={() => setVerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6074] hover:text-[#b0b0c4]" tabIndex={-1} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mayusculas && <p className="text-[11px] text-amber-300 mt-1.5 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />Tienes activadas las mayúsculas.</p>}
                    {(pideRegistro || modoSetup) && password && (
                      <div className="mt-2">
                        <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${f.nivel >= n ? f.color : 'bg-[#313248]'}`} />)}</div>
                        <p className="text-[11px] text-[#8a8b9e] mt-1">Seguridad: <span className="text-[#c0c0cc]">{f.texto}</span></p>
                      </div>
                    )}
                  </div>
                )}

                {pideRegistro && (
                  <>
                    <div>
                      <label className={etiqueta}>Confirmar contraseña</label>
                      <div className="relative"><Lock className={icono} /><input type={verPassword ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repite tu contraseña" className={campo} autoComplete="new-password" /></div>
                      {confirmar && password !== confirmar && <p className="text-[11px] text-red-400 mt-1.5">Las contraseñas no coinciden todavía.</p>}
                    </div>
                    <label className="flex items-start gap-3 text-xs text-[#9a9bb0] cursor-pointer leading-relaxed">
                      <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 accent-[#818cf8] w-4 h-4 flex-shrink-0" />
                      <span>Autorizo el tratamiento de mis datos personales (nombre, cédula, teléfono y correo) para fines académicos y administrativos de este sistema. Solo los verá el equipo administrador.</span>
                    </label>
                  </>
                )}

                {modo === 'recuperar' && (
                  <div className="flex items-start gap-2 text-xs text-[#9a9bb0] bg-[#161722] border border-[#282a3f] rounded-xl p-3">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#a5b4fc]" />
                    <span>Por seguridad, la clave nueva no se envía por correo: se entrega por teléfono al número que registraste. Con ella podrás entrar y elegir tu propia contraseña.</span>
                  </div>
                )}

                <AnimatePresence>
                  {aviso && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-emerald-300 text-xs flex items-start gap-2 overflow-hidden bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" /><span>{aviso}</span>
                    </motion.p>
                  )}
                  {error && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-300 text-xs flex items-start gap-2 overflow-hidden bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5" role="alert">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={enviando} className="w-full py-3 bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {enviando ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Procesando...</>) : modoSetup ? (<><ShieldCheck className="w-4 h-4" />Crear superadmin y entrar</>) : modo === 'registro' ? (<><UserPlus className="w-4 h-4" />Solicitar cuenta</>) : modo === 'recuperar' ? (<><KeyRound className="w-4 h-4" />Avisar al superadmin</>) : (<><LogIn className="w-4 h-4" />Iniciar sesión</>)}
                </motion.button>

                {modo === 'recuperar' && (
                  <button type="button" onClick={() => cambiarModo('login')} className="w-full text-xs text-[#8a8b9e] hover:text-[#b0b0c4] flex items-center justify-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" />Volver a iniciar sesión</button>
                )}
              </motion.form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
