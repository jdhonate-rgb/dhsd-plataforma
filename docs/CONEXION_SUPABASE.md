# Conectar la plataforma a Supabase

Haz esto cuando tengas la cuenta de Supabase nueva. Ningún paso usa DH Rutas ni otros proyectos.

## 1. Crear el proyecto
1. En la cuenta nueva: **New project**, nombre `dhsd-plataforma`, región cercana (por ejemplo São Paulo), contraseña de base de datos larga. Guárdala en tu bóveda; no me la envíes.
2. Entra a **Project Settings → API** y copia solo la **Project URL** y la clave **anon / publishable**. Esas dos son públicas.

## 2. Crear las tablas
Hay dos caminos; el más simple desde tablet:
- **Si me das acceso a la cuenta** (conector de Supabase): yo aplico `supabase/migrations/0001_base.sql` y verifico las políticas.
- **A mano:** SQL Editor → pegar el contenido de `0001_base.sql` → Run.

Después, en **Storage**, comprueba que existe el bucket `cargas` y que está en **privado**.

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

## 5. Conectar la web
Edita `web/config.js` con la Project URL y la clave anon. No pongas ninguna otra clave. Al guardar, la web deja de ser demostración y pide ingreso.

## 6. Probar
1. Ingresa como Propietario y crea una solicitud de prueba.
2. Ingresa como usuario de un área: debe ver solo lo de su área y no poder cambiar estados.
3. Sube un Excel de prueba **sin datos reales**.
