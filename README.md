# NotiMed

Recordatorios de citas médicas, autorizaciones EPS, exámenes y medicinas por correo.

## Estructura

- `sql/schema.sql` — tablas de Supabase (`citas`, `egresos`, `egreso_items`) con RLS.
- `scripts/enviar-recordatorios.js` — se ejecuta por cron, revisa qué necesita recordatorio y envía un correo con Resend.
- `.github/workflows/recordatorios.yml` — corre el script cada hora.
- `docs/` — formulario para registrar citas y egresos desde el celular.

## Configurar

1. En Supabase, correr `sql/schema.sql` en el SQL Editor.
2. En Supabase → Authentication → Users → Add user, crear el usuario (correo + contraseña) con el que se va a iniciar sesión en el formulario.
3. En `docs/app.js`, reemplazar `YOUR_SUPABASE_URL` y `YOUR_SUPABASE_ANON_KEY` con los valores de Project Settings → API (el anon key es público, no es secreto).
4. En GitHub → Settings → Secrets and variables → Actions, confirmar que existen `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFY_EMAIL`.
5. Activar GitHub Pages (Settings → Pages) apuntando a la carpeta `docs/` para tener el formulario en una URL pública.

## Probar localmente

```
npm install
npm run recordatorios
```

Necesita un archivo `.env` local (no se sube al repo) o las variables exportadas en la terminal.
