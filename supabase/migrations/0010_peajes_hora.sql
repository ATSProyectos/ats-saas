-- ============================================================================
-- ATS SAAS · Fase 2.3 · Corrección: falta columna "hora" en peajes_tag
-- ============================================================================

alter table public.peajes_tag
  add column if not exists hora text;
