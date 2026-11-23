// Busca secretos en el repositorio. Las claves JWT solo se permiten si su rol es "anon" (pública).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const archivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
let fallos = 0;
const falla = (f, m) => { console.error(`SECRETO en ${f}: ${m}`); fallos++; };
for (const f of archivos) {
  if (/\.(png|jpg|ico|svg)$/i.test(f)) continue;
  let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    let rol = '?'; try { rol = JSON.parse(Buffer.from(m[1], 'base64url').toString()).role; } catch { /* no JWT */ }
    if (rol !== 'anon') falla(f, `JWT con rol «${rol}»`);
  }
  if (/sb_secret_[A-Za-z0-9]+/.test(t)) falla(f, 'clave sb_secret_');
  if (/postgres(ql)?:\/\/[^\s:@]+:[^\s@]+@/.test(t)) falla(f, 'URL de base de datos con contraseña');
}
if (fallos) process.exit(1);
console.log(`Sin secretos en ${archivos.length} archivos (solo la clave anon pública).`);
