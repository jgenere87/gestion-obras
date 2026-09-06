import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS } from "./datos.js";

const IMPACTO_COLOR = { Alto:"#B3462E", Medio:"#B07D10", Bajo:"#6B675C" };
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Bitacora({ correo, perfil }) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtro, setFiltro] = useState("Abiertas");
  const [msg, setMsg] = useState("");

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("bitacora").select("*").order("fecha", { ascending: false });
    setEventos(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const visibles = eventos.filter((e) => {
    if (filtro === "Abiertas") return e.estado === "Abierta" || e.estado === "En proceso";
    if (filtro === "Todas") return true;
    return e.estado === filtro;
  });

  const cerrar = async (e) => {
    const { error } = await supabase.from("bitacora").update({ estado: "Cerrada" }).eq("id", e.id);
    if (error) { aviso("No se pudo cerrar: " + error.message); return; }
    aviso("Evento cerrado");
    cargar();
  };

  const vencido = (e) => e.fecha_compromiso && e.fecha_compromiso < hoy() && e.estado !== "Cerrada";

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Bitácora de obra · {eventos.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div className="chips">
        {["Abiertas","Todas","Cerrada","Cancelada"].map((f) => (
          <button key={f} className={`chip ${filtro === f ? "on" : ""}`} onClick={() => setFiltro(f)}>{f}</button>
        ))}
      </div>

      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
        {mostrarForm ? "Cancelar" : "+ Registrar evento"}
      </button>

      {mostrarForm && (
        <FormBitacora correo={correo}
          onGuardado={(e) => { setEventos([e, ...eventos]); setMostrarForm(false); aviso("Evento registrado"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       visibles.length === 0 ? (
        <div className="empty"><b>Sin eventos {filtro !== "Todas" ? `en “${filtro}”` : ""}</b>Registra restricciones, riesgos o incidentes desde aquí.</div>
      ) : visibles.map((e) => (
        <div key={e.id} className="ticket" style={{ "--e": vencido(e) ? "#B3462E" : IMPACTO_COLOR[e.impacto] }}>
          <div className="t-head">
            <div>
              <div className="t-id">{e.tipo_evento} · {e.fecha}</div>
              <div className="t-proj">{e.proyecto}</div>
            </div>
            <div className="stamp">{vencido(e) ? "Vencido" : e.estado}</div>
          </div>
          <div className="t-body">
            <b>{e.descripcion}</b><br />
            Impacto: {e.impacto}{e.responsable ? ` · Responsable: ${e.responsable}` : ""}<br />
            {e.accion_requerida && <>Acción requerida: {e.accion_requerida}<br /></>}
            {e.fecha_compromiso && <>Compromiso: {e.fecha_compromiso}<br /></>}
            <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{e.usuario}</span>
          </div>
          {(e.estado === "Abierta" || e.estado === "En proceso") && (
            <div className="t-actions">
              <button className="btn btn-ok" onClick={() => cerrar(e)}>Cerrar evento</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function FormBitacora({ correo, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", fecha: hoy(), tipoEvento: "Restricción", descripcion: "",
    responsable: "", impacto: "Medio", accionRequerida: "", fechaCompromiso: "",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = f.proyectoId && f.descripcion;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", fecha: f.fecha,
      tipo_evento: f.tipoEvento, descripcion: f.descripcion, responsable: f.responsable || null,
      impacto: f.impacto, accion_requerida: f.accionRequerida || null,
      fecha_compromiso: f.fechaCompromiso || null, usuario: correo,
    };
    const { data, error: e } = await supabase.from("bitacora").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginBottom: 20 }}>
      <div className="fld"><label>Proyecto</label>
        <select value={f.proyectoId} onChange={(e) => setF({ ...f, proyectoId: e.target.value })}>
          <option value="">— Seleccionar proyecto —</option>
          {PROYECTOS.map((p) => <option key={p[0]} value={p[0]}>{p[0]} · {p[2]}</option>)}
        </select></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Fecha</label>
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Tipo de evento</label>
          <select value={f.tipoEvento} onChange={(e) => setF({ ...f, tipoEvento: e.target.value })}>
            <option>Restricción</option><option>Riesgo</option><option>Decisión</option>
            <option>Incidente</option><option>Visita</option><option>Otro</option>
          </select></div>
      </div>
      <div className="fld"><label>Descripción</label>
        <textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Responsable</label>
          <input value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Impacto</label>
          <select value={f.impacto} onChange={(e) => setF({ ...f, impacto: e.target.value })}>
            <option>Alto</option><option>Medio</option><option>Bajo</option>
          </select></div>
      </div>
      <div className="fld"><label>Acción requerida</label>
        <textarea rows={2} value={f.accionRequerida} onChange={(e) => setF({ ...f, accionRequerida: e.target.value })} /></div>
      <div className="fld"><label>Fecha compromiso</label>
        <input type="date" value={f.fechaCompromiso} onChange={(e) => setF({ ...f, fechaCompromiso: e.target.value })} /></div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Registrar evento"}</button>
    </div>
  );
}
