import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

/**
 * Carga los 5 catálogos desde Supabase, en el mismo formato de array/tupla
 * que usaba datos.js, para minimizar cambios en el resto del código.
 *
 * PROYECTOS:    [id, tipo, proyecto]
 * PARTIDAS:     [id, componente, entregable, paquete]
 * ACTIVIDADES:  [id, nombre, partida_id, unidad]
 * CONTRATISTAS: ["Nombre", ...]
 * RECURSOS:     [id, nombre, tipo, unidad, costo_referencia]
 *
 * Solo trae los registros activos (activo = true) — los desactivados por
 * Admin en Catálogos dejan de aparecer en los formularios, pero siguen
 * existiendo para no romper reportes/contratos históricos que los usan.
 */
export function useCatalogos() {
  const [PROYECTOS, setProyectos] = useState([]);
  const [PARTIDAS, setPartidas] = useState([]);
  const [ACTIVIDADES, setActividades] = useState([]);
  const [CONTRATISTAS, setContratistas] = useState([]);
  const [RECURSOS, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarTodo = async () => {
    setCargando(true);
    const [p, pt, a, c, r] = await Promise.all([
      supabase.from("cat_proyectos").select("*").eq("activo", true).order("id"),
      supabase.from("cat_partidas").select("*").eq("activo", true).order("id"),
      supabase.from("cat_actividades").select("*").eq("activo", true).order("id"),
      supabase.from("cat_contratistas").select("*").eq("activo", true).order("nombre"),
      supabase.from("cat_recursos").select("*").eq("activo", true).order("id"),
    ]);
    setProyectos((p.data || []).map((x) => [x.id, x.tipo, x.proyecto]));
    setPartidas((pt.data || []).map((x) => [x.id, x.componente, x.entregable, x.paquete]));
    setActividades((a.data || []).map((x) => [x.id, x.nombre, x.partida_id, x.unidad]));
    setContratistas((c.data || []).map((x) => x.nombre));
    setRecursos((r.data || []).map((x) => [x.id, x.nombre, x.tipo, x.unidad, x.costo_referencia]));
    setCargando(false);
  };

  useEffect(() => { cargarTodo(); }, []);

  return { PROYECTOS, PARTIDAS, ACTIVIDADES, CONTRATISTAS, RECURSOS, cargandoCatalogos: cargando, recargarCatalogos: cargarTodo };
}
