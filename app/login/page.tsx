'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Mail, User, LogIn, ShieldCheck, AlertCircle, CheckCircle, UserPlus, Eye, EyeOff,
  Phone, KeyRound, ArrowLeft, Sparkles, FileText, Users, Info, MessageCircle, RotateCw,
} from 'lucide-react'
import { validarNombre, validarEmail, validarPassword, validarTelefono } from '@/lib/validacionesUsuario'

type Modo = 'login' | 'registro' | 'recuperar' | 'verificar'

// Medidor visual de seguridad (la regla real del sistema es: mínimo 8 caracteres con letras y números)
function fuerza(p: string): { nivel: number; texto: string; color: string } {
  if (!p) return { nivel: 0, texto: '', color: 'bg-[color:var(--c-313248)]' }
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
  const [registroAbierto, setRegistroAbierto] = useState(true) // el superadmin puede cerrarlo desde Sistema
  const [canal, setCanal] = useState<'correo' | 'whatsapp'>('whatsapp') // por dónde llegan los códigos (lo decide el servidor)
  const porCorreo = canal === 'correo'
  const medio = porCorreo ? 'correo' : 'WhatsApp'
  const [modo, setModo] = useState<Modo>('login')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const [nombre, setNombre] = useState('')
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
  const [recPaso, setRecPaso] = useState<'telefono' | 'codigo'>('telefono') // olvidé mi contraseña: 1) número  2) código + clave nueva
  // Verificación de la cuenta con un código (por correo o WhatsApp)
  const [codigo, setCodigo] = useState('')
  const [reenvioEn, setReenvioEn] = useState(0)        // segundos que faltan para poder reenviar
  const [reenviando, setReenviando] = useState(false)
  // Suma de verificación (login y registro): la genera y la valida el servidor; cada suma sirve una sola vez
  const [captcha, setCaptcha] = useState<{ pregunta: string; token: string } | null>(null)
  const [captchaResp, setCaptchaResp] = useState('')
  const cargarCaptcha = () => {
    setCaptchaResp('')
    fetch('/api/auth/captcha', { cache: 'no-store' }).then(r => r.json()).then(d => setCaptcha(d?.token ? d : null)).catch(() => setCaptcha(null))
  }
  const [destino, setDestino] = useState('') // a dónde se envió el código: "ad•••@gmail.com" o "número terminado en 4567"

  useEffect(() => {
    if (reenvioEn <= 0) return
    const t = setTimeout(() => setReenvioEn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [reenvioEn])

  const irAVerificar = (mensaje: string, esperar = 0, aDonde = '') => {
    setModo('verificar'); setError(''); setPassword(''); setConfirmar(''); setCodigo('')
    setAviso(mensaje); setReenvioEn(esperar); setDestino(aDonde)
  }

  // Olvidé mi contraseña: pide (o vuelve a pedir) el código por correo o WhatsApp
  const pedirCodigoRecuperacion = async () => {
    const r = await fetch('/api/auth/recuperar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paso: 'pedir', telefono, email }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'No se pudo enviar el código.')
    if (d.enviado === false) { setRecuperacionEnviada(d.mensaje); return } // el envío falló: se avisó al superadmin
    setAviso(d.mensaje); setRecPaso('codigo'); setCodigo(''); setReenvioEn(60)
  }
  const reenviarRecuperacion = async () => {
    if (reenvioEn > 0 || reenviando) return
    setReenviando(true); setError('')
    try { await pedirCodigoRecuperacion() } catch (e: any) { fallar(e instanceof TypeError ? 'No se pudo conectar con el servidor.' : e.message) } finally { setReenviando(false) }
  }

  const reenviarCodigo = async () => {
    if (reenvioEn > 0 || reenviando) return
    const m = validarEmail(email)
    if (m) return fallar(m)
    setReenviando(true); setError(''); setAviso('')
    try {
      const r = await fetch('/api/auth/reenviar-codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const d = await r.json().catch(() => ({}))
      if (typeof d.esperar === 'number') setReenvioEn(d.esperar)
      if (!r.ok) throw new Error(d.error || 'No se pudo reenviar el código.')
      if (d.destino) setDestino(d.destino)
      setCodigo('')
      setAviso(`Te enviamos un código nuevo por ${medio}. El anterior ya no sirve.`)
    } catch (err: any) {
      fallar(err instanceof TypeError ? 'No se pudo conectar con el servidor.' : err.message)
    } finally { setReenviando(false) }
  }

  // Si ya hay una sesión abierta (por ejemplo, se llegó aquí con el botón "atrás"), se entra directo a la app
  useEffect(() => {
    // Solo si /api/auth/me responde con un usuario de verdad (evita bucles si algo responde con una página HTML)
    const comprobar = () => fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then(u => { if (u && u.id) window.location.replace('/') })
      .catch(() => {})
    if (new URLSearchParams(window.location.search).get('sesion') !== 'expirada') comprobar()
    const alMostrar = (e: PageTransitionEvent) => { if (e.persisted) comprobar() }
    window.addEventListener('pageshow', alMostrar)
    return () => window.removeEventListener('pageshow', alMostrar)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sesion') === 'expirada') {
      setAviso('Tu sesión expiró o se cerró. Inicia sesión de nuevo para continuar.')
    }
    fetch('/api/auth/setup')
      .then((r) => r.json())
      .then((d) => { setModoSetup(!!d.necesitaSetup); setRegistroAbierto(d.registroAbierto !== false); if (d.canal === 'correo') setCanal('correo') })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const pideCaptcha = !cargando && (modo === 'login' || modo === 'registro')
  useEffect(() => { if (pideCaptcha) cargarCaptcha() }, [pideCaptcha, modo]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallar = (msg: string) => { setError(msg); setSacudir((n) => n + 1) }

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    setError(''); setAviso(''); setPassword(''); setConfirmar(''); setRecuperacionEnviada(''); setRecPaso('telefono'); setCodigo('')
  }

  const revisarMayusculas = (e: React.KeyboardEvent) => setMayusculas(e.getModifierState && e.getModifierState('CapsLock'))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setAviso('')

    // ---- validación en el navegador (el servidor vuelve a validar todo) ----
    if (modo === 'recuperar') {
      const m = porCorreo ? validarEmail(email) : validarTelefono(telefono)
      if (m) return fallar(m)
      if (recPaso === 'codigo') {
        if (!/^\d{6}$/.test(codigo)) return fallar(`Escribe los 6 dígitos del código que te llegó por ${medio}.`)
        const mp = validarPassword(password)
        if (mp) return fallar(mp)
        if (password !== confirmar) return fallar('Las contraseñas no coinciden.')
      }
    } else if (modo === 'verificar') {
      const m = validarEmail(email)
      if (m) return fallar(m)
      if (!/^\d{6}$/.test(codigo)) return fallar(`Escribe los 6 dígitos del código que te llegó por ${medio}.`)
    } else if (modo === 'registro') {
      const msg = validarNombre(nombre) || validarEmail(email) || (!porCorreo ? validarTelefono(telefono) : null) || validarPassword(password)
      if (msg) return fallar(msg)
      if (password !== confirmar) return fallar('Las contraseñas no coinciden.')
      if (!acepta) return fallar('Debes aceptar el tratamiento de tus datos personales para crear la cuenta.')
    } else if (modoSetup) {
      const msg = validarNombre(nombre) || validarEmail(email) || validarPassword(password)
      if (msg) return fallar(msg)
    } else if (!email.trim() || !password) {
      return fallar('Ingresa tu correo y tu contraseña.')
    }
    if (pideCaptcha && !/^\d{1,3}$/.test(captchaResp.trim())) return fallar('Escribe el resultado de la suma de verificación.')

    setEnviando(true)
    try {
      if (modo === 'verificar') {
        const r = await fetch('/api/auth/verificar-telefono', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, codigo }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No se pudo verificar el código.')
        setAviso(d.mensaje || 'Cuenta confirmada.')
        if (d.entrar) { window.location.replace('/'); return } // la sesión ya quedó abierta
        setModo('login'); setCodigo(''); setReenvioEn(0)
        return
      }

      if (modo === 'recuperar') {
        if (recPaso === 'telefono') { await pedirCodigoRecuperacion(); return }
        const r = await fetch('/api/auth/recuperar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paso: 'cambiar', telefono, email, codigo, password }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No se pudo cambiar la contraseña.')
        setAviso(d.mensaje || '¡Listo!')
        if (d.entrar) { window.location.replace('/'); return }
        return
      }

      if (modo === 'registro') {
        const r = await fetch('/api/auth/registro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, telefono, email, password, aceptaTratamiento: acepta, captchaToken: captcha?.token, captchaRespuesta: captchaResp }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No se pudo enviar la solicitud.')
        setNombre(''); setTelefono(''); setAcepta(false)
        if (d.verificar) {
          irAVerificar(
            d.enviado
              ? `Cuenta creada. Te mandamos un código de 6 dígitos por ${medio} para activarla.`
              : `Cuenta creada, pero no pudimos mandar el ${medio}. Pulsa «Reenviar código» en un momento.`,
            d.enviado ? 60 : 0,
            d.destino || '',
          )
        } else {
          setModo('login'); setPassword(''); setConfirmar('')
          setAviso('Cuenta creada. Ya puedes iniciar sesión.')
        }
        return
      }

      if (modoSetup) {
        const r = await fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, password }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No se pudo crear el superadmin.')
      }

      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, captchaToken: captcha?.token, captchaRespuesta: captchaResp }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 403 && d.codigo === 'VERIFICAR_TELEFONO') { irAVerificar(d.error); return }
      if (!r.ok) throw new Error(d.error || 'No se pudo iniciar sesión.')
      window.location.replace('/') // replace: el login no queda en el historial ("atrás" no vuelve aquí)
      return // se queda en "Procesando..." mientras la página cambia
    } catch (err: any) {
      fallar(err instanceof TypeError ? 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' : err.message)
      if (modo === 'login' || modo === 'registro') cargarCaptcha()
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'w-full bg-[color:var(--c-1b1c2b)] border border-[color:var(--c-313248)] rounded-xl pl-10 pr-3 py-3 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)] focus:ring-2 focus:ring-[color:var(--c-818cf8)]/20 transition-all'
  const etiqueta = 'text-[11px] font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5'
  const icono = 'w-4 h-4 text-[color:var(--c-5f6074)] absolute left-3 top-1/2 -translate-y-1/2'
  const pideRegistro = modo === 'registro'
  const f = fuerza(password)

  const titulo = modoSetup ? 'Configuración inicial' : modo === 'registro' ? 'Crea tu cuenta de profesor' : modo === 'recuperar' ? 'Recuperar contraseña' : modo === 'verificar' ? (porCorreo ? 'Confirma tu correo' : 'Confirma tu WhatsApp') : 'Bienvenido de nuevo'
  const subtitulo = modoSetup
    ? 'Crea la cuenta del superadmin para comenzar.'
    : modo === 'registro' ? `Solo necesitas tu nombre, tu correo y una contraseña. Te enviaremos un código por ${medio} para activar tu cuenta.`
    : modo === 'recuperar' ? (recPaso === 'telefono' ? (porCorreo ? 'Escribe el correo con el que te registraste. Te enviaremos un código para crear una contraseña nueva.' : 'Escribe el número de WhatsApp con el que te registraste. Te enviaremos un código para crear una contraseña nueva.') : `Escribe el código que te llegó por ${medio} y elige tu contraseña nueva.`)
    : modo === 'verificar' ? `Escribe el código de 6 dígitos que enviamos a tu ${medio}${destino ? ` (${destino})` : ''}. Vence en 10 minutos.`
    : 'Inicia sesión para continuar con tu planificación.'

  return (
    <div className="min-h-screen bg-[color:var(--c-12131d)] flex">
      {/* ---------- Panel de marca (solo en pantallas grandes) ---------- */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-[color:var(--c-1a1b3a)] via-[color:var(--c-1d1e2e)] to-[color:var(--c-14151f)]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[color:var(--c-818cf8)]/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/30 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-[color:var(--c-a5b4fc)]" /></div>
          <span className="text-lg font-semibold text-[color:var(--c-e0e0ec)]">Planificador de Evaluaciones</span>
        </div>
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-[color:var(--c-blanco)] leading-tight">Planifica, evalúa y organiza tus cursos en un solo lugar.</h2>
            <p className="text-[color:var(--c-9a9bb0)] mt-3">Una herramienta pensada para profesores, con apoyo de un agente de inteligencia artificial.</p>
          </div>
          <ul className="space-y-4">
            {[
              { i: Sparkles, t: 'Un agente de IA que propone y organiza tus evaluaciones.' },
              { i: FileText, t: 'Planes de acción listos para compartir en PDF.' },
              { i: Users, t: 'Tus secciones y estudiantes, ordenados y separados de los de otros profesores.' },
            ].map(({ i: Icono, t }) => (
              <li key={t} className="flex items-start gap-3 text-sm text-[color:var(--c-c0c0d0)]">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"><Icono className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[color:var(--c-6a6b7e)]">Acceso protegido: contraseñas cifradas, sesiones firmadas y registro de actividad.</p>
      </div>

      {/* ---------- Formulario ---------- */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-6">
            <div className="w-9 h-9 rounded-lg bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/30 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></div>
            <span className="font-semibold text-[color:var(--c-e0e0ec)]">Planificador de Evaluaciones</span>
          </div>

          <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Pestañas Iniciar sesión / Crear cuenta */}
            {!cargando && !modoSetup && modo !== 'recuperar' && modo !== 'verificar' && registroAbierto && (
              <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-[color:var(--c-161722)] border border-[color:var(--c-282a3f)] rounded-xl">
                {([['login', 'Iniciar sesión', LogIn], ['registro', 'Crear cuenta', UserPlus]] as const).map(([id, texto, Icono]) => (
                  <button key={id} type="button" onClick={() => cambiarModo(id)} className={`relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${modo === id ? 'text-[color:var(--c-blanco)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)]'}`}>
                    {modo === id && <motion.span layoutId="pill-login-modo" className="absolute inset-0 bg-[color:var(--c-818cf8)]/20 border border-[color:var(--c-818cf8)]/30 rounded-lg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    <Icono className="relative z-10 w-4 h-4" /><span className="relative z-10">{texto}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mb-6">
              <h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">{titulo}</h1>
              <p className="text-sm text-[color:var(--c-8a8b9e)] mt-1">{subtitulo}</p>
            </div>

            {cargando ? (
              <div className="text-center text-sm text-[color:var(--c-8a8b9e)] py-10">Cargando...</div>
            ) : recuperacionEnviada ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-200">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><p>{recuperacionEnviada}</p>
                </div>
                <p className="text-xs text-[color:var(--c-8a8b9e)]">Si no recibes la llamada o el mensaje, comunícate directamente con el superadmin del sistema.</p>
                <button type="button" onClick={() => cambiarModo('login')} className="w-full py-3 text-sm font-medium text-[color:var(--c-c7d2fe)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl hover:bg-[color:var(--c-2c2d40)] flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Volver a iniciar sesión</button>
              </div>
            ) : (
              <motion.form key={`${modo}-${sacudir}`} animate={sacudir ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }} onSubmit={enviar} className="space-y-4" noValidate>
                {(pideRegistro || modoSetup) && (
                  <div>
                    <label className={etiqueta}>Nombre completo</label>
                    <div className="relative"><User className={icono} /><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ana María Pérez" className={campo} autoComplete="name" autoFocus /></div>
                  </div>
                )}

                {pideRegistro && !porCorreo && (
                  <div>
                    <label className={etiqueta}>Teléfono (WhatsApp)</label>
                    <div className="relative"><Phone className={icono} /><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 0412 123 4567" className={campo} autoComplete="tel" /></div>
                  </div>
                )}

                {(modo !== 'recuperar' || porCorreo) && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className={etiqueta}>Correo electrónico</label>
                    {modo === 'recuperar' && recPaso === 'codigo' && <button type="button" onClick={() => { setRecPaso('telefono'); setAviso(''); setError(''); setCodigo('') }} className="text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)] mb-1.5">Cambiar correo</button>}
                  </div>
                  <div className="relative"><Mail className={icono} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={modo === 'recuperar' && recPaso === 'codigo'} placeholder="tucorreo@ejemplo.com" className={`${campo} ${modo === 'recuperar' && recPaso === 'codigo' ? 'opacity-70' : ''}`} autoComplete="email" autoFocus={!modoSetup && (modo === 'login' || modo === 'recuperar')} /></div>
                </div>
                )}

                {modo === 'recuperar' && (
                  <>
                    {!porCorreo && <div>
                      <div className="flex items-center justify-between">
                        <label className={etiqueta}>Número de WhatsApp</label>
                        {recPaso === 'codigo' && <button type="button" onClick={() => { setRecPaso('telefono'); setAviso(''); setError(''); setCodigo('') }} className="text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)] mb-1.5">Cambiar número</button>}
                      </div>
                      <div className="relative"><Phone className={icono} /><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} readOnly={recPaso === 'codigo'} placeholder="Ej: 0412 123 4567" className={`${campo} ${recPaso === 'codigo' ? 'opacity-70' : ''}`} autoComplete="tel" autoFocus={recPaso === 'telefono'} /></div>
                    </div>}
                    {recPaso === 'codigo' && (
                      <>
                        <div>
                          <label className={etiqueta}>Código de {medio}</label>
                          <div className="relative">
                            <MessageCircle className={icono} />
                            <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus aria-label="Código de 6 dígitos"
                              className={`${campo} text-center text-xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]`} />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Vence en 10 minutos.</span>
                            <button type="button" onClick={reenviarRecuperacion} disabled={reenvioEn > 0 || reenviando} className="text-[11px] font-medium text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)] disabled:text-[color:var(--c-5f6074)] disabled:cursor-not-allowed flex items-center gap-1">
                              <RotateCw className={`w-3 h-3 ${reenviando ? 'animate-spin' : ''}`} />{reenvioEn > 0 ? `Reenviar en ${reenvioEn}s` : 'Reenviar código'}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className={etiqueta}>Contraseña nueva</label>
                          <div className="relative">
                            <Lock className={icono} />
                            <input type={verPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8, con letras y números" className={`${campo} pr-10`} autoComplete="new-password" />
                            <button type="button" onClick={() => setVerPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-b0b0c4)]" aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>{verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          </div>
                        </div>
                        <div>
                          <label className={etiqueta}>Confirmar contraseña nueva</label>
                          <div className="relative"><Lock className={icono} /><input type={verPassword ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={campo} autoComplete="new-password" /></div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {modo === 'verificar' && (
                  <div>
                    <label className={etiqueta}>Código de {medio}</label>
                    <div className="relative">
                      <MessageCircle className={icono} />
                      <input
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus
                        aria-label="Código de 6 dígitos"
                        className={`${campo} text-center text-xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-[color:var(--c-8a8b9e)]">{porCorreo ? '¿No te llegó? Revisa la carpeta de spam o promociones.' : '¿No te llegó? Revisa que el número tenga WhatsApp.'}</span>
                      <button type="button" onClick={reenviarCodigo} disabled={reenvioEn > 0 || reenviando} className="text-[11px] font-medium text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)] disabled:text-[color:var(--c-5f6074)] disabled:cursor-not-allowed flex items-center gap-1">
                        <RotateCw className={`w-3 h-3 ${reenviando ? 'animate-spin' : ''}`} />{reenvioEn > 0 ? `Reenviar en ${reenvioEn}s` : 'Reenviar código'}
                      </button>
                    </div>
                  </div>
                )}

                {modo !== 'recuperar' && modo !== 'verificar' && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={etiqueta}>Contraseña</label>
                      {modo === 'login' && !modoSetup && (
                        <button type="button" onClick={() => cambiarModo('recuperar')} className="text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)] mb-1.5">¿Olvidaste tu contraseña?</button>
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
                      <button type="button" onClick={() => setVerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--c-5f6074)] hover:text-[color:var(--c-b0b0c4)]" tabIndex={-1} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mayusculas && <p className="text-[11px] text-amber-300 mt-1.5 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />Tienes activadas las mayúsculas.</p>}
                    {(pideRegistro || modoSetup) && password && (
                      <div className="mt-2">
                        <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${f.nivel >= n ? f.color : 'bg-[color:var(--c-313248)]'}`} />)}</div>
                        <p className="text-[11px] text-[color:var(--c-8a8b9e)] mt-1">Seguridad: <span className="text-[color:var(--c-c0c0cc)]">{f.texto}</span></p>
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
                    <label className="flex items-start gap-3 text-xs text-[color:var(--c-9a9bb0)] cursor-pointer leading-relaxed">
                      <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 accent-[color:var(--c-818cf8)] w-4 h-4 flex-shrink-0" />
                      <span>Autorizo el tratamiento de mis datos personales (nombre y correo{porCorreo ? '' : ', y teléfono'}) para fines académicos y administrativos de este sistema. Solo los verá el equipo administrador.</span>
                    </label>
                  </>
                )}

                {pideCaptcha && (
                  <div>
                    <label htmlFor="captcha-respuesta" className={etiqueta}>Verificación humana</label>
                    {/* Cuadrícula fija: la operación ocupa el espacio libre, la respuesta tiene ancho fijo y el botón es cuadrado */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 7.5rem 3rem', gap: '0.5rem', height: '3.25rem' }}>
                      {/* La operación, en grande */}
                      <div aria-hidden="true" className="flex items-center justify-center rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1f2136)] font-mono font-bold text-[color:var(--c-e0e0ec)] select-none whitespace-nowrap overflow-hidden" style={{ fontSize: '1.15rem', letterSpacing: '0.05em' }}>
                        {captcha
                          ? <>{captcha.pregunta.split(' + ').map((n, i) => <span key={i}>{i > 0 && <span className="text-[color:var(--c-818cf8)]" style={{ margin: '0 0.6rem' }}>+</span>}{n}</span>)}<span className="text-[color:var(--c-818cf8)]" style={{ margin: '0 0.6rem' }}>=</span><span className="text-[color:var(--c-a5b4fc)]">?</span></>
                          : <span className="w-4 h-4 border-2 border-[color:var(--c-313248)] border-t-[color:var(--c-818cf8)] rounded-full animate-spin" />}
                      </div>
                      {/* La respuesta, al lado */}
                      <input id="captcha-respuesta" value={captchaResp} onChange={(e) => setCaptchaResp(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Resultado"
                        aria-label={captcha ? `Resultado de ${captcha.pregunta}` : 'Resultado de la suma'} autoComplete="off"
                        style={{ width: '100%', minWidth: 0, fontSize: captchaResp ? '1.15rem' : '0.85rem' }}
                        className="bg-[color:var(--c-1b1c2b)] border border-[color:var(--c-313248)] rounded-xl px-2 text-center font-semibold text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)] transition-colors" />
                      <button type="button" onClick={cargarCaptcha} title="Otra suma" aria-label="Cambiar la suma" className="flex items-center justify-center rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1b1c2b)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:border-[color:var(--c-818cf8)]/40 transition-colors"><RotateCw className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                {modo === 'recuperar' && (
                  <div className="flex items-start gap-2 text-xs text-[color:var(--c-9a9bb0)] bg-[color:var(--c-161722)] border border-[color:var(--c-282a3f)] rounded-xl p-3">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[color:var(--c-a5b4fc)]" />
                    <span>{recPaso === 'telefono' ? (porCorreo ? 'Usa el mismo correo con el que creaste tu cuenta. Si el código no llega, se le avisará al superadmin para que te ayude.' : 'Usa el mismo número que pusiste al crear tu cuenta. Si el WhatsApp no llega, se le avisará al superadmin para que te ayude.') : 'Al confirmar, tu contraseña cambia y entras directo al sistema.'}</span>
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

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={enviando} className="w-full py-3 bg-gradient-to-r from-[color:var(--c-818cf8)] to-[color:var(--c-6366f1)] text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {enviando ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Procesando...</>) : modoSetup ? (<><ShieldCheck className="w-4 h-4" />Crear superadmin y entrar</>) : modo === 'registro' ? (<><UserPlus className="w-4 h-4" />Crear cuenta</>) : modo === 'recuperar' ? (recPaso === 'telefono' ? (<><MessageCircle className="w-4 h-4" />Enviarme un código por {medio}</>) : (<><KeyRound className="w-4 h-4" />Cambiar contraseña y entrar</>)) : modo === 'verificar' ? (<><ShieldCheck className="w-4 h-4" />Confirmar y entrar</>) : (<><LogIn className="w-4 h-4" />Iniciar sesión</>)}
                </motion.button>

                {(modo === 'recuperar' || modo === 'verificar') && (
                  <button type="button" onClick={() => cambiarModo('login')} className="w-full text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)] flex items-center justify-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" />Volver a iniciar sesión</button>
                )}
              </motion.form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
