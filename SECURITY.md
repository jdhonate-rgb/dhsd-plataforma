# Seguridad

Este repositorio es **público** y contiene solo el código de la plataforma de DH SOFTWARE DATA, nunca datos. Por eso todo lo que se suba debe poder verlo cualquiera.

- Nunca subir contraseñas, claves `service_role`, URLs de conexión a la base de datos, ni archivos Excel/CSV con datos reales. El `.gitignore` bloquea `.xlsx`, `.xls` y `.csv`, y el CI busca secretos obvios.
- La URL del proyecto Supabase y la clave `anon`/«publishable» de Supabase sí puede estar en `web/config.js`: es pública por diseño. La protección real son las políticas de seguridad por filas (RLS), que se prueban en cada cambio.
- Si un secreto se sube por error: revocarlo en el proveedor, avisar al Propietario y registrarlo en el Handbook (`09_SECURITY/INCIDENT_REGISTER.md`) sin escribir el valor.

## Repositorio público: qué implica
- Cualquiera puede ver la URL del proyecto y la clave `anon`. No es un fallo: toda la seguridad está en las políticas RLS, que se prueban en cada cambio.
- El registro público de Supabase Auth debe estar **apagado** y los usuarios los crea el Propietario. Sin perfil, un usuario no ve nada.
- No documentar aquí nombres de clientes, pacientes, correos personales ni detalles internos de otros sistemas.
