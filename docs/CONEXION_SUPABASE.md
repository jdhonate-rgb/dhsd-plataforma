# Conectar la plataforma a Supabase

Haz esto cuando tengas la cuenta de Supabase nueva. Ningún paso usa DH Rutas ni otros proyectos.

## Estado (2026-11-23)
Ya están hechos los pasos 1, 2 y 5 con el proyecto `dhsd-plataforma` (`btkootcynsyrkufnikcq`, región us-west-2): el esquema (migraciones 0001 a 0003) está aplicado, el bucket `cargas` es privado y `web/config.js` apunta a ese proyecto con la clave pública `anon`. Faltan los pasos 3, 4 y 6.

## 3. Cargar las áreas
Con el listado oficial que entregues (una línea por área; el código va en minúsculas, sin espacios ni tildes):
```sql
insert into public.areas (codigo, nombre) values ('cartera', 'Cartera'), ('otra-area', 'Otra área');
```

## 3b. Crear tu usuario Propietario
1. **Authentication → Users → Add user**: tu correo y una contraseña fuerte. Activa MFA cuando esté disponible para tu cuenta.
2. En el SQL Editor, activa tu perfil (cambia el correo):
   ```sql
   insert into public.perfiles (id, rol, nombre)
   select id, 'propietario', 'Propietario' from auth.users where email = 'TU_CORREO';
   ```
3. Para un usuario de área, crea su usuario igual y luego:
   ```sql
   insert into public.perfiles (id, rol, area_id, nombre)
   select u.id, 'area', a.id, 'Nombre visible'
   from auth.users u, public.areas a where u.email = 'CORREO' and a.codigo = 'CODIGO_DEL_AREA';
   ```
   Un usuario sin perfil no puede ver nada.

## 4. Apagar el registro público
**Authentication → Providers → Email**: desactiva *Allow new users to sign up*. Los usuarios los creas tú.

## 5. Conectar la web (hecho)
`web/config.js` ya tiene la URL y la clave anon. Con esos valores la web deja de ser demostración y pide ingreso. Si algún día cambias de proyecto, edita solo esas dos líneas y ninguna otra clave.

## 6. Probar
1. Ingresa como Propietario y crea una solicitud de prueba.
2. Ingresa como usuario de un área: debe ver solo lo de su área y no poder cambiar estados.
3. Sube un Excel de prueba **sin datos reales**.
