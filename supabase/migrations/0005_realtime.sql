-- ============================================================================
-- ATS SAAS · Fase 2 · Habilita Realtime en ventas_servicios
-- Permite que el dashboard se actualice solo cuando alguien registra un
-- servicio, sin recargar la página. RLS sigue aplicando sobre el stream.
-- ============================================================================

alter publication supabase_realtime add table public.ventas_servicios;
