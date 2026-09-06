import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, PARTIDAS, ACTIVIDADES, CONTRATISTAS, ESTADOS, RECURSOS } from "./datos.js";
import { SeccionEquipos, SeccionHH } from "./EquiposHH.jsx";
import BuscarSelect from "./BuscarSelect.jsx";
import Contratos from "./Contratos.jsx";
import Cubicaciones from "./Cubicaciones.jsx";
import OrdenesCambio from "./OrdenesCambio.jsx";
import RFI from "./RFI.jsx";
import Admin from "./Admin.jsx";
import Planificacion from "./Planificacion.jsx";
import "./estilos.css";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setListo(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion?.user?.email) { setPerfil(null); return; }
    supabase.from("perfiles").select("*").eq("correo", sesion.user.email).single()
      .then(({ data }) => setPerfil(data));
  }, [sesion]);

  if (!listo) return <div className="cargando">Cargando…</div>;
  if (!sesion) return <Login />;
  if (!perfil) return <div className="cargando">Verificando perfil… Si esto no avanza, tu correo no está en la tabla perfiles.</div>;
  return <Principal sesion={sesion} perfil={perfil} />;
}

/* ══════════════ LOGIN ══════════════ */
function Login() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEnviando(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    if (error) setError("Correo o contraseña incorrectos.");
    setEnviando(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={entrar}>
        <div className="logo" style={{ color: "var(--tinta)" }}>
          Gestión de Obras
          <small>CAP CANA · ACCESO</small>
        </div>
        <div className="fld" style={{ marginTop: 22 }}>
          <label>Correo</label>
          <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
            placeholder="tu@capcana.com" autoComplete="email" />
        </div>
        <div className="fld">
          <label>Contraseña</label>
          <input type="password" required value={clave} onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password" />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-big" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

/* ══════════════ APP PRINCIPAL ══════════════ */
function Principal({ sesion, perfil }) {
  const [vista, setVista] = useState("panel");
  const [reportes, setReportes] = useState([]);
  const [filtro, setFiltro] = useState("Todos");
  const [msg, setMsg] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    const { data, error } = await supabase.from("reportes")
      .select("*").order("creado", { ascending: false }).limit(300);
    if (!error) setReportes(data || []);
  };
  useEffect(() => { cargar(); }, []);

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cambiarEstado = async (id, estado) => {
    const { error } = await supabase.from("reportes").update({ estado }).eq("id", id);
    if (error) { aviso("No se pudo actualizar: " + error.message); return; }
    setReportes(reportes.map((r) => (r.id === id ? { ...r, estado } : r)));
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este reporte? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("reportes").delete().eq("id", id);
    if (error) { aviso("Solo el Admin puede eliminar."); return; }
    setReportes(reportes.filter((r) => r.id !== id));
  };

  const visibles = useMemo(() => {
    let r = reportes;
    if (filtro !== "Todos") r = r.filter((x) => x.estado === filtro);
    return r;
  }, [reportes, filtro]);

  const kpi = useMemo(() => ({
    total: reportes.length,
    hoy: reportes.filter((r) => r.fecha === hoy()).length,
    pend: reportes.filter((r) => r.estado === "Enviado").length,
    val: reportes.filter((r) => r.estado === "Validado").length,
  }), [reportes]);

  const porProyecto = useMemo(() => {
    const m = {};
    reportes.forEach((r) => { m[r.proyecto_id] = (m[r.proyecto_id] || 0) + 1; });
    return Object.entries(m)
      .map(([id, n]) => ({ id, n, nombre: PROYECTOS.find((p) => p[0] === Number(id))?.[2] || id }))
      .sort((a, b) => b.n - a.n).slice(0, 8);
  }, [reportes]);

  const puedeValidar = perfil.rol === "Admin" || perfil.rol === "Supervisor";

  const actsFiltradas = useMemo(() => {
    if (!busqueda) return ACTIVIDADES;
    const q = busqueda.toLowerCase();
    return ACTIVIDADES.filter((a) => a[1].toLowerCase().includes(q) || a[0].toLowerCase().includes(q));
  }, [busqueda]);

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-top">
          <div className="logo">Gestión de Obras<small>CAP CANA · REPORTE DE CAMPO</small></div>
          <div className="quien">
            <span>{perfil.nombre} · {perfil.rol}</span>
            <button className="salir" onClick={() => supabase.auth.signOut()}>Salir</button>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="Secciones">
        {[["panel","Panel"],["planificacion","Planificación"],["nuevo","+ Reporte"],["reportes","Reportes"],["contratos","Contratos"],
          ["cubicaciones","Cubicaciones"],["oc","Órdenes de Cambio"],["rfi","RFI"],["catalogo","Catálogo"],
          ...(perfil.rol === "Admin" ? [["admin","Administración"]] : [])].map(([k,t]) => (
          <button key={k} className={vista === k ? "on" : ""} onClick={() => setVista(k)}>{t}</button>
        ))}
      </nav>

      <main className="main">
        {vista === "panel" && (
          <>
            <div className="kpis">
              <div className="kpi" style={{"--k":"var(--acero)"}}><b>{kpi.total}</b><span>Reportes</span></div>
              <div className="kpi" style={{"--k":"var(--ambar)"}}><b>{kpi.hoy}</b><span>Hoy</span></div>
              <div className="kpi" style={{"--k":"#B07D10"}}><b>{kpi.pend}</b><span>Por validar</span></div>
              <div className="kpi" style={{"--k":"var(--verde)"}}><b>{kpi.val}</b><span>Validados</span></div>
            </div>
            <div className="sec-t">Actividad por proyecto</div>
            {porProyecto.length === 0 ? (
              <div className="empty"><b>Sin reportes aún</b>Crea el primero desde “+ Reporte”.</div>
            ) : porProyecto.map((p) => (
              <div className="bar-row" key={p.id}>
                <span className="bar-name">{p.nombre}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(p.n / porProyecto[0].n) * 100}%` }} /></div>
                <span className="bar-n">{p.n}</span>
              </div>
            ))}
            <div className="sec-t">Últimos reportes</div>
            {visibles.slice(0, 3).map((r) => <Ticket key={r.id} r={r} correo={sesion.user.email} perfil={perfil} />)}
          </>
        )}

        {vista === "nuevo" && (
          <FormReporte correo={sesion.user.email} perfil={perfil}
            onGuardado={(r, estado) => { setReportes([r, ...reportes]); aviso(`Reporte guardado como ${estado}`); setVista("reportes"); }} />
        )}

        {vista === "reportes" && (
          <>
            <div className="chips">
              {["Todos","Borrador","Enviado","Validado","Rechazado"].map((e) => (
                <button key={e} className={`chip ${filtro === e ? "on" : ""}`} onClick={() => setFiltro(e)}>{e}</button>
              ))}
            </div>
            {msg && <div className="saved-note">✓ {msg}</div>}
            {visibles.length === 0 && (
              <div className="empty"><b>Sin reportes {filtro !== "Todos" ? `en “${filtro}”` : ""}</b>
                {perfil.rol !== "Admin" ? "Solo ves reportes de tus proyectos asignados." : "Los reportes del equipo aparecerán aquí."}</div>
            )}
            {visibles.map((r) => (
              <Ticket key={r.id} r={r} correo={sesion.user.email} perfil={perfil}>
                <div className="t-actions">
                  {puedeValidar && r.estado === "Enviado" && <>
                    <button className="btn btn-ok" onClick={() => cambiarEstado(r.id, "Validado")}>Validar</button>
                    <button className="btn btn-no" onClick={() => cambiarEstado(r.id, "Rechazado")}>Rechazar</button>
                  </>}
                  {r.estado === "Borrador" && r.usuario === sesion.user.email &&
                    <button className="btn btn-amb" onClick={() => cambiarEstado(r.id, "Enviado")}>Enviar</button>}
                  {r.estado === "Rechazado" && r.usuario === sesion.user.email &&
                    <button className="btn btn-amb" onClick={() => cambiarEstado(r.id, "Enviado")}>Reenviar</button>}
                  {perfil.rol === "Admin" &&
                    <button className="btn btn-gh" onClick={() => eliminar(r.id)}>Eliminar</button>}
                </div>
              </Ticket>
            ))}
          </>
        )}

        {vista === "planificacion" && <Planificacion correo={sesion.user.email} perfil={perfil} />}
        {vista === "contratos" && <Contratos correo={sesion.user.email} perfil={perfil} />}
        {vista === "cubicaciones" && <Cubicaciones correo={sesion.user.email} perfil={perfil} />}
        {vista === "oc" && <OrdenesCambio correo={sesion.user.email} perfil={perfil} />}
        {vista === "rfi" && <RFI correo={sesion.user.email} perfil={perfil} />}
        {vista === "admin" && perfil.rol === "Admin" && <Admin correo={sesion.user.email} />}

        {vista === "catalogo" && (
          <>
            <div className="sec-t" style={{ marginTop: 0 }}>Actividades · {ACTIVIDADES.length}</div>
            <div className="fld" style={{ maxWidth: 400 }}>
              <input placeholder="Buscar actividad o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            {actsFiltradas.slice(0, 60).map((a) => {
              const p = PARTIDAS.find((x) => x[0] === a[2]);
              return (
                <div className="cat-row" key={a[0]}>
                  <span className="cat-id">{a[0]}</span>
                  <span style={{ flex: 1 }}><b>{a[1]}</b>
                    <span style={{ color: "var(--tinta2)", fontSize: 12 }}> — {p?.[1]} / {p?.[3]}</span></span>
                  <span className="unit-tag" style={{ marginLeft: 0 }}>{a[3]}</span>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

/* ══════════════ FORMULARIO ══════════════ */
function FormReporte({ correo, perfil, onGuardado }) {
  const [f, setF] = useState({
    fecha: hoy(), proyectoId: "", actividadId: "",
    cantidad: "", frente: "", comentario: "",
  });
  const [foto, setFoto] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  // Actividades contratadas y activas del proyecto elegido — solo esto se puede reportar
  const [actsContratadas, setActsContratadas] = useState([]);
  const [cargandoActs, setCargandoActs] = useState(false);

  // Recursos usados en este reporte (equipo/material/trabajo)
  const [recursosAgregados, setRecursosAgregados] = useState([]);
  const [recBusqueda, setRecBusqueda] = useState("");
  const [recSel, setRecSel] = useState("");
  const [recCantidad, setRecCantidad] = useState("");
  const [recCosto, setRecCosto] = useState("");

  // Equipos y Hora-Hombre de la jornada
  const [equipos, setEquipos] = useState([]);
  const [hh, setHH] = useState([]);

  useEffect(() => {
    if (!f.proyectoId) { setActsContratadas([]); return; }
    setCargandoActs(true);
    supabase.from("contrato_actividades")
      .select("*, contratos!inner(id, proyecto_id, contratista, estado)")
      .eq("estado", "Activo")
      .eq("contratos.proyecto_id", Number(f.proyectoId))
      .eq("contratos.estado", "Activo")
      .then(({ data }) => { setActsContratadas(data || []); setCargandoActs(false); });
  }, [f.proyectoId]);

  const actSel = actsContratadas.find((a) => a.actividad_id === f.actividadId);
  const unidad = actSel ? actSel.unidad : "";
  const contratistaAuto = actSel ? actSel.contratos.contratista : "";

  // Cuánto ya se ha reportado de esta actividad en este proyecto, y cuánto queda disponible
  const [yaReportado, setYaReportado] = useState(0);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);

  useEffect(() => {
    if (!f.proyectoId || !f.actividadId) { setYaReportado(0); return; }
    setCargandoSaldo(true);
    supabase.from("reportes")
      .select("cantidad")
      .eq("proyecto_id", Number(f.proyectoId))
      .eq("actividad_id", f.actividadId)
      .neq("estado", "Rechazado")
      .then(({ data }) => {
        const suma = (data || []).reduce((s, r) => s + Number(r.cantidad), 0);
        setYaReportado(suma);
        setCargandoSaldo(false);
      });
  }, [f.proyectoId, f.actividadId]);

  const cantidadContratada = actSel ? Number(actSel.cantidad_contratada) : 0;
  const disponible = cantidadContratada - yaReportado;
  const seExcede = actSel && Number(f.cantidad) > disponible;

  const requiereRespaldoHoras = actSel?.tipo_medicion === "Horas";
  const tieneRespaldoHoras = equipos.length > 0 || hh.length > 0;
  const ok = f.proyectoId && f.actividadId && f.cantidad > 0 && !seExcede
    && (!requiereRespaldoHoras || tieneRespaldoHoras);
  const verPrecios = perfil.rol === "Admin" || perfil.rol === "Supervisor";

  const recursosFiltrados = useMemo(() => {
    if (!recBusqueda) return RECURSOS;
    const q = recBusqueda.toLowerCase();
    return RECURSOS.filter((r) => r[1].toLowerCase().includes(q) || r[0].toLowerCase().includes(q));
  }, [recBusqueda]);

  const recursoSel = RECURSOS.find((r) => r[0] === recSel);

  const elegirRecurso = (id) => {
    setRecSel(id);
    const r = RECURSOS.find((x) => x[0] === id);
    setRecCosto(r ? String(r[4]) : "");
  };

  const agregarRecurso = () => {
    if (!recursoSel || !recCantidad || Number(recCantidad) <= 0) return;
    setRecursosAgregados([...recursosAgregados, {
      recurso_id: recursoSel[0], recurso: recursoSel[1], tipo: recursoSel[2],
      unidad: recursoSel[3], cantidad: Number(recCantidad), costo_unitario: Number(recCosto) || 0,
    }]);
    setRecSel(""); setRecCantidad(""); setRecCosto(""); setRecBusqueda("");
  };

  const quitarRecurso = (idx) => setRecursosAgregados(recursosAgregados.filter((_, i) => i !== idx));

  const totalRecursos = recursosAgregados.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);

  const guardar = async (estado) => {
    setSubiendo(true); setError("");
    let foto_url = null;

    if (foto) {
      const nombre = `${Date.now()}-${foto.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: e1 } = await supabase.storage.from("fotos").upload(nombre, foto);
      if (e1) { setError("Error subiendo foto: " + e1.message); setSubiendo(false); return; }
      foto_url = supabase.storage.from("fotos").getPublicUrl(nombre).data.publicUrl;
    }

    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const pt = actSel ? PARTIDAS.find((x) => x[0] === actSel.partida_id) : null;
    const fila = {
      fecha: f.fecha, proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "",
      componente: pt?.[1] || "", paquete: pt?.[3] || "",
      actividad_id: f.actividadId, actividad: actSel?.actividad || "", unidad,
      cantidad: Number(f.cantidad), contratista: contratistaAuto,
      frente: f.frente || null, comentario: f.comentario || null,
      foto_url, usuario: correo, estado,
    };
    const { data, error: e2 } = await supabase.from("reportes").insert(fila).select().single();
    if (e2) {
      const msg = e2.message.includes("excede lo contratado")
        ? e2.message.replace(/^.*?:\s*/, "") // limpia el prefijo técnico de Postgres
        : "No se pudo guardar: " + e2.message;
      setError(msg); setSubiendo(false); return;
    }

    if (recursosAgregados.length > 0) {
      const filasRecursos = recursosAgregados.map((r) => ({
        reporte_id: data.id, recurso_id: r.recurso_id, recurso: r.recurso, tipo: r.tipo,
        unidad: r.unidad, cantidad: r.cantidad, costo_unitario: r.costo_unitario, usuario: correo,
      }));
      const { error: e3 } = await supabase.from("recursos_reporte").insert(filasRecursos);
      if (e3) { setError("Reporte guardado, pero los recursos no se pudieron guardar: " + e3.message); setSubiendo(false); return; }
    }

    if (equipos.length > 0) {
      const filasEquipos = equipos.map((eq) => ({ ...eq, reporte_id: data.id, usuario: correo }));
      const { error: e4 } = await supabase.from("reporte_equipos").insert(filasEquipos);
      if (e4) { setError("Reporte guardado, pero los equipos no se pudieron guardar: " + e4.message); setSubiendo(false); return; }
    }

    if (hh.length > 0) {
      const filasHH = hh.map((x) => ({ ...x, reporte_id: data.id, usuario: correo }));
      const { error: e5 } = await supabase.from("reporte_hh").insert(filasHH);
      if (e5) { setError("Reporte guardado, pero la hora-hombre no se pudo guardar: " + e5.message); setSubiendo(false); return; }
    }

    setSubiendo(false);
    onGuardado(data, estado);
  };

  return (
    <div className="form">
      <div className="sec-t" style={{ marginTop: 0 }}>Nuevo reporte diario</div>

      <div className="fld"><label>Fecha</label>
        <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>

      <div className="fld"><label>Proyecto</label>
        <BuscarSelect value={f.proyectoId} onChange={(v) => setF({ ...f, proyectoId: v, actividadId: "" })}
          placeholder="— Seleccionar proyecto —"
          options={PROYECTOS.map((p) => ({ value: p[0], label: `${p[0]} · ${p[2]}` }))} /></div>

      {f.proyectoId && !cargandoActs && actsContratadas.length === 0 && (
        <div className="error-msg">
          Este proyecto no tiene actividades contratadas y activas todavía. No se puede reportar
          hasta que un contrato esté <b>Activo</b> — revisa Planificación y Contratos.
        </div>
      )}

      <div className="fld"><label>Actividad contratada {unidad && <span className="unit-tag">{unidad}</span>}</label>
        <BuscarSelect value={f.actividadId} onChange={(v) => setF({ ...f, actividadId: v })}
          disabled={!f.proyectoId || actsContratadas.length === 0}
          placeholder={!f.proyectoId ? "Primero elige el proyecto" : cargandoActs ? "Cargando…" : "— Seleccionar actividad —"}
          options={actsContratadas.map((a) => ({ value: a.actividad_id, label: a.actividad, sub: `${a.actividad_id} · ${a.contratos.contratista}` }))} /></div>

      {actSel && !cargandoSaldo && (
        <div style={{
          background: seExcede ? "#FBEAE5" : "#E8F5E9",
          border: `1px solid ${seExcede ? "#B3462E" : "#2E7D4F"}`,
          borderRadius: 4, padding: "10px 12px", fontSize: 12.5,
          color: seExcede ? "#7D2020" : "#1B5E20", marginBottom: 14, lineHeight: 1.5,
        }}>
          Contratado: <b>{cantidadContratada} {unidad}</b> · Ya reportado: <b>{yaReportado} {unidad}</b> ·
          Disponible: <b>{disponible} {unidad}</b>
          {seExcede && (
            <div style={{ marginTop: 4, fontWeight: 700 }}>
              ⚠ Esta cantidad excede lo contratado por {(Number(f.cantidad) - disponible).toFixed(2)} {unidad}.
              No se puede guardar hasta que ajustes la cantidad o se contrate más.
            </div>
          )}
        </div>
      )}

      {requiereRespaldoHoras && (
        <div style={{
          background: tieneRespaldoHoras ? "#E8F5E9" : "#FFF2CC",
          border: `1px solid ${tieneRespaldoHoras ? "#2E7D4F" : "#B07D10"}`,
          borderRadius: 4, padding: "10px 12px", fontSize: 12.5,
          color: tieneRespaldoHoras ? "#1B5E20" : "#7D4A00", marginBottom: 14, lineHeight: 1.5,
        }}>
          Esta partida se cubica <b>por horas</b>. {tieneRespaldoHoras
            ? "Ya agregaste el respaldo de equipo/hora-hombre más abajo."
            : "Debes agregar al menos un equipo o cuadrilla con sus horas más abajo antes de guardar."}
        </div>
      )}

      <div className="fld"><label>Cantidad ejecutada {unidad && `(${unidad})`}</label>
        <input type="number" min="0" step="any" placeholder="0.00"
          value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></div>

      {contratistaAuto && (
        <div className="fld"><label>Contratista</label>
          <div style={{ padding: "11px 10px", border: "1px solid var(--linea)", borderRadius: 3, background: "#F2F0EA", fontSize: 15 }}>
            {contratistaAuto}
          </div>
        </div>
      )}


      <div className="sec-t" style={{ fontSize: 15 }}>Recursos utilizados</div>

      {recursosAgregados.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {recursosAgregados.map((r, i) => (
            <div key={i} className="cat-row" style={{ alignItems: "center" }}>
              <span className="unit-tag" style={{ marginLeft: 0 }}>{r.tipo}</span>
              <span style={{ flex: 1 }}>
                <b>{r.recurso}</b>{" "}
                <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
                  — {r.cantidad} {r.unidad}
                  {verPrecios && <> × ${r.costo_unitario} = ${(r.cantidad * r.costo_unitario).toFixed(2)}</>}
                </span>
              </span>
              <button type="button" className="btn btn-gh" style={{ padding: "4px 10px" }}
                onClick={() => quitarRecurso(i)}>Quitar</button>
            </div>
          ))}
          {verPrecios && (
            <div className="saved-note" style={{ color: "var(--tinta)", fontWeight: 600 }}>
              Total recursos: ${totalRecursos.toFixed(2)}
            </div>
          )}
        </div>
      )}

      <div className="fld"><label>Buscar recurso</label>
        <input placeholder="Ej: Excavadora, Concreto, Personal…" value={recBusqueda}
          onChange={(e) => setRecBusqueda(e.target.value)} /></div>

      {recBusqueda && !recSel && (
        <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 14, border: "1px solid var(--linea)", borderRadius: 3 }}>
          {recursosFiltrados.slice(0, 25).map((r) => (
            <div key={r[0]} onClick={() => elegirRecurso(r[0])}
              style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--linea)", fontSize: 13 }}>
              <b>{r[1]}</b> <span style={{ color: "var(--tinta2)" }}>— {r[2]} · {r[3]}{verPrecios && <> · ref. ${r[4]}</>}</span>
            </div>
          ))}
          {recursosFiltrados.length === 0 && <div style={{ padding: 10, fontSize: 13, color: "var(--tinta2)" }}>Sin resultados</div>}
        </div>
      )}

      {recSel && recursoSel && (
        <div className="form" style={{ background: "#fff", marginBottom: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            {recursoSel[1]} <span className="unit-tag">{recursoSel[3]}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1, marginBottom: 0 }}>
              <label>Cantidad</label>
              <input type="number" min="0" step="any" placeholder="0.00"
                value={recCantidad} onChange={(e) => setRecCantidad(e.target.value)} />
            </div>
            {verPrecios && (
              <div className="fld" style={{ flex: 1, marginBottom: 0 }}>
                <label>Costo unitario</label>
                <input type="number" min="0" step="any" value={recCosto}
                  onChange={(e) => setRecCosto(e.target.value)} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ok" onClick={agregarRecurso}>Agregar</button>
            <button type="button" className="btn btn-gh" onClick={() => { setRecSel(""); setRecBusqueda(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="fld"><label>Foto de la actividad (opcional)</label>
        <input type="file" accept="image/*" capture="environment"
          onChange={(e) => setFoto(e.target.files?.[0] || null)} />
        {foto && <div className="saved-note">📷 {foto.name}</div>}</div>

      <SeccionEquipos contratistaDefecto={contratistaAuto} equipos={equipos} setEquipos={setEquipos} />
      <SeccionHH contratistaDefecto={contratistaAuto} hh={hh} setHH={setHH} />

      <div className="fld"><label>Frente de trabajo (opcional)</label>
        <input placeholder="Ej: Sector A · Km 2+000" value={f.frente}
          onChange={(e) => setF({ ...f, frente: e.target.value })} /></div>

      <div className="fld"><label>Comentario (opcional)</label>
        <textarea rows={2} placeholder="Observaciones de la jornada"
          value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} /></div>

      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || subiendo} onClick={() => guardar("Enviado")}>
        {subiendo ? "Guardando…" : "Enviar para validación"}</button>
      <button className="btn btn-gh" style={{ width: "100%", marginTop: 8 }}
        disabled={!ok || subiendo} onClick={() => guardar("Borrador")}>Guardar como borrador</button>
    </div>
  );
}

/* ══════════════ TICKET ══════════════ */
function Ticket({ r: rInicial, children, correo, perfil }) {
  const [r, setR] = useState(rInicial);
  const [recursos, setRecursos] = useState(null);
  const [equiposHH, setEquiposHH] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ef, setEf] = useState({ cantidad: r.cantidad, frente: r.frente || "", comentario: r.comentario || "" });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  // Agregar nuevos equipos/HH/recursos a un reporte ya creado
  const [equiposNuevos, setEquiposNuevos] = useState([]);
  const [hhNuevos, setHhNuevos] = useState([]);
  const [guardandoExtra, setGuardandoExtra] = useState(false);

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor" || r.usuario === correo;
  const verPrecios = perfil.rol === "Admin" || perfil.rol === "Supervisor";

  const guardarEdicion = async () => {
    setGuardandoEdit(true); setErrorEdit("");

    // Verificar contra lo contratado, excluyendo la cantidad actual de este mismo reporte
    const { data: contratoAct } = await supabase.from("contrato_actividades")
      .select("cantidad_contratada, contratos!inner(proyecto_id, estado)")
      .eq("actividad_id", r.actividad_id).eq("estado", "Activo")
      .eq("contratos.proyecto_id", r.proyecto_id).eq("contratos.estado", "Activo")
      .maybeSingle();

    if (contratoAct) {
      const { data: otros } = await supabase.from("reportes")
        .select("cantidad").eq("proyecto_id", r.proyecto_id).eq("actividad_id", r.actividad_id)
        .neq("estado", "Rechazado").neq("id", r.id);
      const sumaOtros = (otros || []).reduce((s, x) => s + Number(x.cantidad), 0);
      const disponibleEdit = Number(contratoAct.cantidad_contratada) - sumaOtros;
      if (Number(ef.cantidad) > disponibleEdit) {
        setErrorEdit(
          `Esta cantidad excede lo contratado. Disponible: ${disponibleEdit} ${r.unidad} ` +
          `(contratado ${contratoAct.cantidad_contratada}, ya reportado en otros ${sumaOtros}).`
        );
        setGuardandoEdit(false);
        return;
      }
    }

    const { data, error } = await supabase.from("reportes").update({
      cantidad: Number(ef.cantidad), frente: ef.frente || null, comentario: ef.comentario || null,
    }).eq("id", r.id).select().single();
    setGuardandoEdit(false);
    if (error) { setErrorEdit("No se pudo guardar: " + error.message); return; }
    setR(data);
    setEditando(false);
  };

  const verRecursos = async () => {
    if (recursos !== null) { setRecursos(null); return; } // toggle cerrar
    setCargando(true);
    const { data, error } = await supabase.from("recursos_reporte")
      .select("*").eq("reporte_id", r.id).order("creado");
    setCargando(false);
    setRecursos(error ? [] : data);
  };

  const verEquiposHH = async () => {
    if (equiposHH !== null) { setEquiposHH(null); return; }
    setCargando(true);
    const [eq, hh] = await Promise.all([
      supabase.from("reporte_equipos").select("*").eq("reporte_id", r.id).order("creado"),
      supabase.from("reporte_hh").select("*").eq("reporte_id", r.id).order("creado"),
    ]);
    setCargando(false);
    setEquiposHH({ equipos: eq.data || [], hh: hh.data || [] });
  };

  const recargarEquiposHH = async () => {
    const [eq, hh] = await Promise.all([
      supabase.from("reporte_equipos").select("*").eq("reporte_id", r.id).order("creado"),
      supabase.from("reporte_hh").select("*").eq("reporte_id", r.id).order("creado"),
    ]);
    setEquiposHH({ equipos: eq.data || [], hh: hh.data || [] });
  };

  const recargarRecursos = async () => {
    const { data } = await supabase.from("recursos_reporte").select("*").eq("reporte_id", r.id).order("creado");
    setRecursos(data || []);
  };

  const quitarEquipo = async (id) => {
    await supabase.from("reporte_equipos").delete().eq("id", id);
    recargarEquiposHH();
  };
  const quitarHH = async (id) => {
    await supabase.from("reporte_hh").delete().eq("id", id);
    recargarEquiposHH();
  };
  const quitarRecursoExistente = async (id) => {
    await supabase.from("recursos_reporte").delete().eq("id", id);
    recargarRecursos();
  };
  const editarRecursoExistente = async (id, cambios) => {
    const { error } = await supabase.from("recursos_reporte").update(cambios).eq("id", id);
    if (!error) recargarRecursos();
    return error;
  };
  const editarEquipo = async (id, cambios) => {
    const { error } = await supabase.from("reporte_equipos").update(cambios).eq("id", id);
    if (!error) recargarEquiposHH();
    return error;
  };
  const editarHH = async (id, cambios) => {
    const { error } = await supabase.from("reporte_hh").update(cambios).eq("id", id);
    if (!error) recargarEquiposHH();
    return error;
  };

  const guardarEquiposNuevos = async () => {
    setGuardandoExtra(true);
    const filas = equiposNuevos.map((eq) => ({ ...eq, reporte_id: r.id, usuario: correo }));
    const { error } = await supabase.from("reporte_equipos").insert(filas);
    setGuardandoExtra(false);
    if (!error) { setEquiposNuevos([]); recargarEquiposHH(); }
  };
  const guardarHhNuevos = async () => {
    setGuardandoExtra(true);
    const filas = hhNuevos.map((x) => ({ ...x, reporte_id: r.id, usuario: correo }));
    const { error } = await supabase.from("reporte_hh").insert(filas);
    setGuardandoExtra(false);
    if (!error) { setHhNuevos([]); recargarEquiposHH(); }
  };
  const agregarRecursoExistente = async (rec) => {
    setGuardandoExtra(true);
    const { error } = await supabase.from("recursos_reporte").insert({ ...rec, reporte_id: r.id, usuario: correo });
    setGuardandoExtra(false);
    if (!error) recargarRecursos();
  };

  const totalRecursos = (recursos || []).reduce((s, x) => s + Number(x.monto ?? x.cantidad * x.costo_unitario), 0);
  const totalHH = (equiposHH?.hh || []).reduce((s, x) => s + Number(x.total_hh ?? x.cant_personal * x.horas_trabajadas), 0);

  return (
    <div className="ticket" style={{ "--e": ESTADOS[r.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">RPT-{String(r.id).slice(0, 8).toUpperCase()} · {r.fecha}</div>
          <div className="t-proj">{r.proyecto}</div>
        </div>
        <div className="stamp">{r.estado}</div>
      </div>

      {!editando ? (
        <div className="t-body">
          {r.componente} → {r.paquete}<br />
          <b>{r.actividad_id} · {r.actividad}</b> — <span className="t-qty">{r.cantidad} {r.unidad}</span><br />
          {r.contratista}{r.frente ? ` · ${r.frente}` : ""}
          {r.comentario ? <><br /><i>“{r.comentario}”</i></> : ""}
          {r.foto_url && <><br /><a href={r.foto_url} target="_blank" rel="noreferrer">📷 Ver foto</a></>}
          <br /><span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{r.usuario}</span>
        </div>
      ) : (
        <div style={{ padding: "0 20px 14px 26px" }}>
          <div className="fld"><label>Cantidad ejecutada ({r.unidad})</label>
            <input type="number" min="0" step="any" value={ef.cantidad} onChange={(e) => setEf({ ...ef, cantidad: e.target.value })} /></div>
          <div className="fld"><label>Frente de trabajo</label>
            <input value={ef.frente} onChange={(e) => setEf({ ...ef, frente: e.target.value })} /></div>
          <div className="fld"><label>Comentario</label>
            <textarea rows={2} value={ef.comentario} onChange={(e) => setEf({ ...ef, comentario: e.target.value })} /></div>
          {errorEdit && <div className="error-msg">{errorEdit}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={guardandoEdit} onClick={guardarEdicion}>
              {guardandoEdit ? "Guardando…" : "Guardar cambios"}</button>
            <button className="btn btn-gh" onClick={() => { setEditando(false); setEf({ cantidad: r.cantidad, frente: r.frente || "", comentario: r.comentario || "" }); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="t-actions" style={{ paddingTop: 0 }}>
        {puedeEditar && !editando && (
          <button className="btn btn-gh" onClick={() => setEditando(true)}>Editar</button>
        )}
        <button className="btn btn-gh" onClick={verRecursos}>
          {cargando ? "Cargando…" : recursos !== null ? "Ocultar recursos" : "Ver recursos"}
        </button>
        <button className="btn btn-gh" onClick={verEquiposHH}>
          {cargando ? "Cargando…" : equiposHH !== null ? "Ocultar equipos/HH" : "Ver equipos/HH"}
        </button>
      </div>

      {equiposHH !== null && (
        <div style={{ padding: "0 20px 16px 26px" }}>
          {equiposHH.equipos.length === 0 && equiposHH.hh.length === 0 && !puedeEditar ? (
            <div style={{ fontSize: 12, color: "var(--tinta2)" }}>Sin equipos ni hora-hombre registrados.</div>
          ) : (
            <>
              {equiposHH.equipos.map((e) => (
                <LineaEquipo key={e.id} e={e} puedeEditar={puedeEditar}
                  onQuitar={() => quitarEquipo(e.id)}
                  onGuardar={(cambios) => editarEquipo(e.id, cambios)} />
              ))}
              {equiposHH.hh.map((x) => (
                <LineaHH key={x.id} x={x} puedeEditar={puedeEditar}
                  onQuitar={() => quitarHH(x.id)}
                  onGuardar={(cambios) => editarHH(x.id, cambios)} />
              ))}
              {equiposHH.hh.length > 0 && (
                <div className="saved-note" style={{ color: "var(--tinta)", fontWeight: 600 }}>Total HH: {totalHH}</div>
              )}
            </>
          )}
          {puedeEditar && (
            <>
              <SeccionEquipos contratistaDefecto={r.contratista}
                equipos={equiposNuevos} setEquipos={setEquiposNuevos} />
              {equiposNuevos.length > 0 && (
                <button className="btn btn-ok" style={{ marginBottom: 14 }} disabled={guardandoExtra}
                  onClick={guardarEquiposNuevos}>{guardandoExtra ? "Guardando…" : "Guardar equipos agregados"}</button>
              )}
              <SeccionHH contratistaDefecto={r.contratista} hh={hhNuevos} setHH={setHhNuevos} />
              {hhNuevos.length > 0 && (
                <button className="btn btn-ok" disabled={guardandoExtra}
                  onClick={guardarHhNuevos}>{guardandoExtra ? "Guardando…" : "Guardar hora-hombre agregada"}</button>
              )}
            </>
          )}
        </div>
      )}

      {recursos !== null && (
        <div style={{ padding: "0 20px 16px 26px" }}>
          {recursos.length === 0 && !puedeEditar ? (
            <div style={{ fontSize: 12, color: "var(--tinta2)" }}>Sin recursos registrados en este reporte.</div>
          ) : (
            <>
              {recursos.map((x) => (
                <LineaRecurso key={x.id} x={x} puedeEditar={puedeEditar} verPrecios={verPrecios}
                  onQuitar={() => quitarRecursoExistente(x.id)}
                  onGuardar={(cambios) => editarRecursoExistente(x.id, cambios)} />
              ))}
              {recursos.length > 0 && verPrecios && (
                <div className="saved-note" style={{ color: "var(--tinta)", fontWeight: 600 }}>
                  Total: ${totalRecursos.toFixed(2)}
                </div>
              )}
            </>
          )}
          {puedeEditar && (
            <SeccionRecursoInline onAgregar={agregarRecursoExistente} guardando={guardandoExtra} verPrecios={verPrecios} />
          )}
        </div>
      )}

      {children}
    </div>
  );
}

/* Formulario compacto para agregar un recurso a un reporte ya creado */
/* Línea de recurso con edición en línea (cantidad y costo unitario) */
function LineaRecurso({ x, puedeEditar, verPrecios, onQuitar, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(x.cantidad);
  const [costo, setCosto] = useState(x.costo_unitario);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setCantidad(x.cantidad); setCosto(x.costo_unitario); }, [x.cantidad, x.costo_unitario]);

  const guardar = async () => {
    setGuardando(true);
    const error = await onGuardar({ cantidad: Number(cantidad), costo_unitario: Number(costo) });
    setGuardando(false);
    if (!error) setEditando(false);
  };

  if (editando) {
    return (
      <div className="cat-row" style={{ margin: "0 0 6px", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <span><span className="unit-tag" style={{ marginLeft: 0 }}>{x.tipo}</span> <b>{x.recurso}</b></span>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            placeholder="Cantidad" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
          {verPrecios && (
            <input type="number" min="0" step="any" value={costo} onChange={(e) => setCosto(e.target.value)}
              placeholder="Costo unitario" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ok" style={{ padding: "6px 14px" }} disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-gh" style={{ padding: "6px 14px" }} onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-row" style={{ margin: "0 0 6px", alignItems: "center" }}>
      <span className="unit-tag" style={{ marginLeft: 0 }}>{x.tipo}</span>
      <span style={{ flex: 1, fontSize: 13 }}>
        <b>{x.recurso}</b>{" "}
        <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
          — {x.cantidad} {x.unidad}{verPrecios && <> × ${x.costo_unitario}</>}
        </span>
      </span>
      {verPrecios && (
        <span className="t-qty" style={{ fontSize: 13 }}>${Number(x.monto ?? x.cantidad * x.costo_unitario).toFixed(2)}</span>
      )}
      {puedeEditar && (
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => setEditando(true)}>Editar</button>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={onQuitar}>Quitar</button>
        </div>
      )}
    </div>
  );
}

/* Línea de equipo con edición en línea */
function LineaEquipo({ e, puedeEditar, onQuitar, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [horasTrab, setHorasTrab] = useState(e.horas_trabajadas);
  const [horasParadas, setHorasParadas] = useState(e.horas_paradas);
  const [causa, setCausa] = useState(e.causa_parada || "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setHorasTrab(e.horas_trabajadas); setHorasParadas(e.horas_paradas); setCausa(e.causa_parada || "");
  }, [e.horas_trabajadas, e.horas_paradas, e.causa_parada]);

  const guardar = async () => {
    setGuardando(true);
    const error = await onGuardar({
      horas_trabajadas: Number(horasTrab) || 0, horas_paradas: Number(horasParadas) || 0, causa_parada: causa || null,
    });
    setGuardando(false);
    if (!error) setEditando(false);
  };

  if (editando) {
    return (
      <div className="cat-row" style={{ margin: "0 0 6px", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <span><span className="unit-tag" style={{ marginLeft: 0 }}>{e.tipo_equipo}</span> <b>{e.equipo}</b></span>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min="0" step="any" value={horasTrab} onChange={(ev) => setHorasTrab(ev.target.value)}
            placeholder="Horas trabajadas" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
          <input type="number" min="0" step="any" value={horasParadas} onChange={(ev) => setHorasParadas(ev.target.value)}
            placeholder="Horas paradas" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
        </div>
        <input value={causa} onChange={(ev) => setCausa(ev.target.value)} placeholder="Causa de parada (opcional)"
          style={{ border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ok" style={{ padding: "6px 14px" }} disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-gh" style={{ padding: "6px 14px" }} onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-row" style={{ margin: "0 0 6px", alignItems: "center" }}>
      <span className="unit-tag" style={{ marginLeft: 0 }}>{e.tipo_equipo}</span>
      <span style={{ flex: 1, fontSize: 13 }}>
        <b>{e.equipo}</b>{" "}
        <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
          — {e.contratista ? `${e.contratista} · ` : ""}{e.horas_trabajadas}h trabajadas, {e.horas_paradas}h paradas
        </span>
      </span>
      {puedeEditar && (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => setEditando(true)}>Editar</button>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={onQuitar}>Quitar</button>
        </div>
      )}
    </div>
  );
}

/* Línea de hora-hombre con edición en línea */
function LineaHH({ x, puedeEditar, onQuitar, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [cantPersonal, setCantPersonal] = useState(x.cant_personal);
  const [horas, setHoras] = useState(x.horas_trabajadas);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setCantPersonal(x.cant_personal); setHoras(x.horas_trabajadas); }, [x.cant_personal, x.horas_trabajadas]);

  const guardar = async () => {
    setGuardando(true);
    const error = await onGuardar({ cant_personal: Number(cantPersonal) || 1, horas_trabajadas: Number(horas) || 0 });
    setGuardando(false);
    if (!error) setEditando(false);
  };

  if (editando) {
    return (
      <div className="cat-row" style={{ margin: "0 0 6px", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <span><span className="unit-tag" style={{ marginLeft: 0 }}>{x.cargo}</span></span>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min="1" value={cantPersonal} onChange={(e) => setCantPersonal(e.target.value)}
            placeholder="Cantidad de personas" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
          <input type="number" min="0" step="any" value={horas} onChange={(e) => setHoras(e.target.value)}
            placeholder="Horas trabajadas" style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ok" style={{ padding: "6px 14px" }} disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-gh" style={{ padding: "6px 14px" }} onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-row" style={{ margin: "0 0 6px", alignItems: "center" }}>
      <span className="unit-tag" style={{ marginLeft: 0 }}>{x.cargo}</span>
      <span style={{ flex: 1, fontSize: 13 }}>
        <b>{x.cant_personal} persona(s)</b>{" "}
        <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
          — {x.contratista ? `${x.contratista} · ` : ""}{x.horas_trabajadas}h c/u
        </span>
      </span>
      {puedeEditar && (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => setEditando(true)}>Editar</button>
          <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={onQuitar}>Quitar</button>
        </div>
      )}
    </div>
  );
}

function SeccionRecursoInline({ onAgregar, guardando, verPrecios }) {
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const filtrados = useMemo(() => {
    if (!busqueda) return RECURSOS;
    const q = busqueda.toLowerCase();
    return RECURSOS.filter((r) => r[1].toLowerCase().includes(q) || r[0].toLowerCase().includes(q));
  }, [busqueda]);

  const recursoSel = RECURSOS.find((r) => r[0] === sel);

  const elegir = (id) => {
    setSel(id);
    const r = RECURSOS.find((x) => x[0] === id);
    setCosto(r ? String(r[4]) : "");
    setBusqueda("");
  };

  const confirmar = () => {
    if (!recursoSel || !cantidad || Number(cantidad) <= 0) return;
    onAgregar({
      recurso_id: recursoSel[0], recurso: recursoSel[1], tipo: recursoSel[2], unidad: recursoSel[3],
      cantidad: Number(cantidad), costo_unitario: Number(costo) || 0,
    });
    setSel(""); setCantidad(""); setCosto(""); setMostrar(false);
  };

  if (!mostrar) return <button className="btn btn-gh" onClick={() => setMostrar(true)}>+ Agregar recurso</button>;

  return (
    <div className="form" style={{ background: "#fff", padding: 14 }}>
      {!sel ? (
        <div className="fld"><label>Buscar recurso</label>
          <input placeholder="Ej: Excavadora, Concreto, Personal…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} autoFocus />
          {busqueda && (
            <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 6, border: "1px solid var(--linea)", borderRadius: 3 }}>
              {filtrados.slice(0, 20).map((r) => (
                <div key={r[0]} onClick={() => elegir(r[0])}
                  style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--linea)", fontSize: 13 }}>
                  <b>{r[1]}</b> <span style={{ color: "var(--tinta2)" }}>— {r[2]} · {r[3]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            {recursoSel.label ?? recursoSel[1]} <span className="unit-tag">{recursoSel[3]}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Cantidad</label>
              <input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
            {verPrecios && (
              <div className="fld" style={{ flex: 1 }}><label>Costo unitario</label>
                <input type="number" min="0" step="any" value={costo} onChange={(e) => setCosto(e.target.value)} /></div>
            )}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {sel && <button className="btn btn-ok" disabled={guardando} onClick={confirmar}>
          {guardando ? "Guardando…" : "Agregar"}</button>}
        <button className="btn btn-gh" onClick={() => { setMostrar(false); setSel(""); setBusqueda(""); }}>Cancelar</button>
      </div>
    </div>
  );
}
