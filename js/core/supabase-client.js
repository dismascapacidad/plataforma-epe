/**
 * supabase-client.js
 * Cliente único de Supabase para toda la plataforma. Depende de que el SDK
 * de Supabase (UMD, vía CDN) esté cargado ANTES que este archivo — ver el
 * <script src="https://cdn.jsdelivr.net/...supabase-js..."> que precede a
 * este en cada página que lo usa (login.html, dashboard.html,
 * apps-terceros/index.html).
 *
 * La "anon key" de acá abajo es pública a propósito: es la forma normal en
 * que funciona Supabase, cualquiera puede verla en el código fuente del
 * sitio. La seguridad real la dan las políticas de RLS de cada tabla (ver
 * supabase/001_schema_inicial.sql y 002_patches.sql), no el secreto de esta
 * clave — por eso NUNCA va acá la "service_role key", esa sí es secreta.
 *
 * Namespace: EpeSupabase (la instancia del cliente en sí, no un objeto con
 * funciones como los demás módulos — se usa directo: EpeSupabase.from(...),
 * EpeSupabase.auth.signInWithPassword(...), etc.)
 */
var EpeSupabase = window.supabase.createClient(
  "https://citvpcsigyvughqnnmng.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdHZwY3NpZ3l2dWdocW5ubW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjY2NDYsImV4cCI6MjEwNTYwMjY0Nn0.lzPxjv4IFqKzTW7gNIvsOVs-IBS3y8zT-_BAG8yKXfA"
);
