"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Componente invisible: escucha cambios en tiempo real de la tabla
 * ventas_servicios y refresca los datos del dashboard automáticamente,
 * sin que el usuario tenga que recargar la página.
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-ventas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ventas_servicios" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
