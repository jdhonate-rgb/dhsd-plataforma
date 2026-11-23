# Seguridad

Este repositorio es privado y contiene el código de la plataforma de DH SOFTWARE DATA, no datos.

- Nunca subir contraseñas, claves `service_role`, URLs de conexión a la base de datos, ni archivos Excel/CSV con datos reales. El `.gitignore` bloquea `.xlsx`, `.xls` y `.csv`, y el CI busca secretos obvios.
- La clave `anon`/«publishable» de Supabase sí puede estar en `web/config.js`: es pública por diseño. La protección real son las políticas de seguridad por filas (RLS), que se prueban en cada cambio.
- Si un secreto se sube por error: revocarlo en el proveedor, avisar al Propietario y registrarlo en el Handbook (`09_SECURITY/INCIDENT_REGISTER.md`) sin escribir el valor.
