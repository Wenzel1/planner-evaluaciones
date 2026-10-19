// scripts/restablecer-superadmin.mjs
// Para cuando el SUPERADMIN olvida su propia contraseña (nadie más puede restablecerla desde la app).
// Uso, desde la carpeta frontend:
//     node scripts/restablecer-superadmin.mjs correo@del-superadmin.com NuevaClave123
// La clave debe tener mínimo 8 caracteres con letras y números.
import { readFileSync, existsSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

// Carga DATABASE_URL (y las demás variables) desde .env / .env.local si no están definidas
for (const archivo of ['.env.local', '.env']) {
  if (!existsSync(archivo)) continue
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const [correo, clave] = process.argv.slice(2)
if (!correo || !clave) { console.error('Uso: node scripts/restablecer-superadmin.mjs correo@x.com NuevaClave123'); process.exit(1) }
if (clave.length < 8 || !/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) { console.error('La clave debe tener mínimo 8 caracteres, con letras y números.'); process.exit(1) }

const prisma = new PrismaClient()
try {
  const u = await prisma.usuario.findUnique({ where: { email: correo.trim().toLowerCase() } })
  if (!u) { console.error('No existe una cuenta con ese correo.'); process.exit(1) }
  if (u.rol !== 'SUPERADMIN') { console.error('Esa cuenta no es SUPERADMIN. Este script solo restablece la cuenta del superadmin.'); process.exit(1) }

  // Mismo formato que lib/password.ts: salt:hash en hexadecimal (scrypt, 64 bytes)
  const salt = randomBytes(16)
  const hash = scryptSync(clave, salt, 64)
  await prisma.usuario.update({
    where: { id: u.id },
    data: { passwordHash: `${salt.toString('hex')}:${hash.toString('hex')}`, activo: true, pendiente: false, debeCambiarPassword: false, sesionesDesde: new Date() },
  })
  console.log(`Listo: la contraseña de ${u.nombre} (${u.email}) fue restablecida. Ya puedes iniciar sesión.`)
} finally {
  await prisma.$disconnect()
}
