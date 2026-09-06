import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, PARTIDAS, ACTIVIDADES, CONTRATISTAS, ESTADOS } from "./datos.js";
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
        {[["panel","Panel"],["nuevo","+ Reporte"],["reportes","Reportes"],["catalogo","Catálogo"]].map(([k,t]) => (
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
            {visibles.slice(0, 3).map((r) => <Ticket key={r.id} r={r} />)}
          </>
        )}

        {vista === "nuevo" && (
          <FormReporte correo={sesion.user.email}
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
                {perfil.rol === "Ingeniero" ? "Solo ves tus propios reportes." : "Los reportes del equipo aparecerán aquí."}</div>
            )}
            {visibles.map((r) => (
              <Ticket key={r.id} r={r}>
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
function FormReporte({ correo, onGuardado }) {
  const [f, setF] = useState({
    fecha: hoy(), proyectoId: "", partidaId: "", actividadId: "",
    cantidad: "", contratista: "", frente: "", comentario: "",
  });
  const [foto, setFoto] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const acts = ACTIVIDADES.filter((a) => a[2] === Number(f.partidaId));
  const actSel = ACTIVIDADES.find((a) => a[0] === f.actividadId);
  const unidad = actSel ? actSel[3] : "";
  const ok = f.proyectoId && f.partidaId && f.actividadId && f.cantidad > 0 && f.contratista;

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
    const pt = PARTIDAS.find((x) => x[0] === Number(f.partidaId));
    const fila = {
      fecha: f.fecha, proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "",
      componente: pt?.[1] || "", paquete: pt?.[3] || "",
      actividad_id: f.actividadId, actividad: actSel?.[1] || "", unidad,
      cantidad: Number(f.cantidad), contratista: f.contratista,
      frente: f.frente || null, comentario: f.comentario || null,
      foto_url, usuario: correo, estado,
    };
    const { data, error: e2 } = await supabase.from("reportes").insert(fila).select().single();
    setSubiendo(false);
    if (e2) { setError("No se pudo guardar: " + e2.message); return; }
    onGuardado(data, estado);
  };

  return (
    <div className="form">
      <div className="sec-t" style={{ marginTop: 0 }}>Nuevo reporte diario</div>

      <div className="fld"><label>Fecha</label>
        <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>

      <div className="fld"><label>Proyecto</label>
        <select value={f.proyectoId} onChange={(e) => setF({ ...f, proyectoId: e.target.value })}>
          <option value="">— Seleccionar proyecto —</option>
          {PROYECTOS.map((p) => <option key={p[0]} value={p[0]}>{p[0]} · {p[2]}</option>)}
        </select></div>

      <div className="fld"><label>Partida</label>
        <select value={f.partidaId} onChange={(e) => setF({ ...f, partidaId: e.target.value, actividadId: "" })}>
          <option value="">— Seleccionar partida —</option>
          {PARTIDAS.map((p) => <option key={p[0]} value={p[0]}>{p[1]} → {p[2]} → {p[3]}</option>)}
        </select></div>

      <div className="fld"><label>Actividad {unidad && <span className="unit-tag">{unidad}</span>}</label>
        <select value={f.actividadId} onChange={(e) => setF({ ...f, actividadId: e.target.value })} disabled={!f.partidaId}>
          <option value="">{f.partidaId ? "— Seleccionar actividad —" : "Primero elige la partida"}</option>
          {acts.map((a) => <option key={a[0]} value={a[0]}>{a[0]} · {a[1]}</option>)}
        </select></div>

      <div className="fld"><label>Cantidad ejecutada {unidad && `(${unidad})`}</label>
        <input type="number" min="0" step="any" placeholder="0.00"
          value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></div>

      <div className="fld"><label>Contratista</label>
        <select value={f.contratista} onChange={(e) => setF({ ...f, contratista: e.target.value })}>
          <option value="">— Seleccionar contratista —</option>
          {CONTRATISTAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select></div>

      <div className="fld"><label>Foto de la actividad (opcional)</label>
        <input type="file" accept="image/*" capture="environment"
          onChange={(e) => setFoto(e.target.files?.[0] || null)} />
        {foto && <div className="saved-note">📷 {foto.name}</div>}</div>

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
function Ticket({ r, children }) {
  return (
    <div className="ticket" style={{ "--e": ESTADOS[r.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">RPT-{String(r.id).slice(0, 8).toUpperCase()} · {r.fecha}</div>
          <div className="t-proj">{r.proyecto}</div>
        </div>
        <div className="stamp">{r.estado}</div>
      </div>
      <div className="t-body">
        {r.componente} → {r.paquete}<br />
        <b>{r.actividad_id} · {r.actividad}</b> — <span className="t-qty">{r.cantidad} {r.unidad}</span><br />
        {r.contratista}{r.frente ? ` · ${r.frente}` : ""}
        {r.comentario ? <><br /><i>“{r.comentario}”</i></> : ""}
        {r.foto_url && <><br /><a href={r.foto_url} target="_blank" rel="noreferrer">📷 Ver foto</a></>}
        <br /><span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{r.usuario}</span>
      </div>
      {children}
    </div>
  );
}
