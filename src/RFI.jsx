import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS } from "./datos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_RFI = { Abierto:"#B07D10", Respondido:"#33586E", Cerrado:"#2E7D4F" };
const PRIORIDAD_COLOR = { Alta:"#B3462E", Media:"#B07D10", Baja:"#6B675C" };
const hoy = () => new Date().toISOString().slice(0, 10);

export default function RFI({ correo, perfil }) {
  const [rfis, setRfis] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtro, setFiltro] = useState("Abiertos");
  const [msg, setMsg] = useState("");

  const puedeResponder = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("rfis").select("*").order("creado", { ascending: false });
    setRfis(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const visibles = rfis.filter((r) => {
    if (filtro === "Abiertos") return r.estado === "Abierto" || r.estado === "Respondido";
    if (filtro === "Todos") return true;
    return r.estado === filtro;
  });

  const vencido = (r) => r.fecha_limite && r.fecha_limite < hoy() && r.estado === "Abierto";

  const cerrar = async (r) => {
    const { error } = await supabase.from("rfis").update({ estado: "Cerrado" }).eq("id", r.id);
    if (error) { aviso("No se pudo cerrar: " + error.message); return; }
    aviso("RFI cerrado");
    cargar();
  };

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Solicitudes de Información (RFI) · {rfis.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div className="chips">
        {["Abiertos","Todos","Abierto","Respondido","Cerrado"].map((f) => (
          <button key={f} className={`chip ${filtro === f ? "on" : ""}`} onClick={() => setFiltro(f)}>{f}</button>
        ))}
      </div>

      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
        {mostrarForm ? "Cancelar" : "+ Nuevo RFI"}
      </button>

      {mostrarForm && (
        <FormRFI correo={correo}
          onGuardado={(r) => { setRfis([r, ...rfis]); setMostrarForm(false); aviso(`RFI #${r.numero} creado`); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       visibles.length === 0 ? (
        <div className="empty"><b>Sin RFIs {filtro !== "Todos" ? `en “${filtro}”` : ""}</b>Crea el primero arriba para pedir una aclaración formal.</div>
      ) : visibles.map((r) => (
        <RfiCard key={r.id} r={r} puedeResponder={puedeResponder} vencido={vencido(r)}
          onCerrar={cerrar} onCambio={cargar} aviso={aviso} />
      ))}
    </>
  );
}

function FormRFI({ correo, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", asunto: "", pregunta: "", referencia: "", prioridad: "Media", fechaLimite: "",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = f.proyectoId && f.asunto && f.pregunta;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", asunto: f.asunto, pregunta: f.pregunta,
      referencia: f.referencia || null, prioridad: f.prioridad, fecha_limite: f.fechaLimite || null,
      solicitado_por: correo,
    };
    const { data, error: e } = await supabase.from("rfis").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginBottom: 20 }}>
      <div className="fld"><label>Proyecto</label>
        <BuscarSelect value={f.proyectoId} onChange={(v) => setF({ ...f, proyectoId: v })}
          placeholder="— Seleccionar proyecto —"
          options={PROYECTOS.map((p) => ({ value: p[0], label: `${p[0]} · ${p[2]}` }))} /></div>
      <div className="fld"><label>Asunto</label>
        <input placeholder="Ej: Aclaración de nivel de piso terminado" value={f.asunto}
          onChange={(e) => setF({ ...f, asunto: e.target.value })} /></div>
      <div className="fld"><label>Pregunta</label>
        <textarea rows={3} placeholder="Describe la duda o ambigüedad con el mayor detalle posible"
          value={f.pregunta} onChange={(e) => setF({ ...f, pregunta: e.target.value })} /></div>
      <div className="fld"><label>Referencia (plano, especificación, partida)</label>
        <input placeholder="Ej: Plano A-102, Detalle 4" value={f.referencia}
          onChange={(e) => setF({ ...f, referencia: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Prioridad</label>
          <select value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
            <option>Alta</option><option>Media</option><option>Baja</option>
          </select></div>
        <div className="fld" style={{ flex: 1 }}><label>Fecha límite de respuesta</label>
          <input type="date" value={f.fechaLimite} onChange={(e) => setF({ ...f, fechaLimite: e.target.value })} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Enviando…" : "Enviar RFI"}</button>
    </div>
  );
}

function RfiCard({ r, puedeResponder, vencido, onCerrar, onCambio, aviso }) {
  const [mostrarRespuesta, setMostrarRespuesta] = useState(false);
  const [respuesta, setRespuesta] = useState(r.respuesta || "");
  const [impactaCosto, setImpactaCosto] = useState(r.impacta_costo);
  const [impactaPlazo, setImpactaPlazo] = useState(r.impacta_plazo);
  const [guardando, setGuardando] = useState(false);

  const enviarRespuesta = async () => {
    if (!respuesta.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from("rfis").update({
      respuesta, respondido_por: r.solicitado_por === r.respondido_por ? r.respondido_por : undefined,
      estado: "Respondido", fecha_respuesta: hoy(),
      impacta_costo: impactaCosto, impacta_plazo: impactaPlazo,
    }).eq("id", r.id);
    setGuardando(false);
    if (error) { aviso("No se pudo guardar la respuesta: " + error.message); return; }
    aviso("Respuesta enviada");
    setMostrarRespuesta(false);
    onCambio();
  };

  return (
    <div className="ticket" style={{ "--e": vencido ? "#B3462E" : ESTADOS_RFI[r.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">RFI #{r.numero} · {r.creado?.slice(0, 10)}</div>
          <div className="t-proj">{r.proyecto}</div>
        </div>
        <div className="stamp">{vencido ? "Vencido" : r.estado}</div>
      </div>
      <div className="t-body">
        <b>{r.asunto}</b>{" "}
        <span className="unit-tag" style={{ background: PRIORIDAD_COLOR[r.prioridad] }}>{r.prioridad}</span><br />
        {r.pregunta}<br />
        {r.referencia && <>Ref.: {r.referencia}<br /></>}
        {r.fecha_limite && <>Respuesta esperada antes de: {r.fecha_limite}<br /></>}
        <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{r.solicitado_por}</span>

        {r.respuesta && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--linea)" }}>
            <b style={{ color: "var(--verde)" }}>Respuesta:</b> {r.respuesta}<br />
            {(r.impacta_costo || r.impacta_plazo) && (
              <span style={{ fontSize: 12, color: "var(--rojo)" }}>
                {r.impacta_costo && "⚠ Impacta costo "}{r.impacta_plazo && "⚠ Impacta plazo"}
              </span>
            )}
          </div>
        )}
      </div>

      {puedeResponder && r.estado === "Abierto" && !mostrarRespuesta && (
        <div className="t-actions">
          <button className="btn btn-amb" onClick={() => setMostrarRespuesta(true)}>Responder</button>
        </div>
      )}

      {mostrarRespuesta && (
        <div style={{ padding: "0 20px 16px 26px" }}>
          <div className="fld"><label>Respuesta</label>
            <textarea rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={impactaCosto} onChange={(e) => setImpactaCosto(e.target.checked)} />
              Impacta costo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={impactaPlazo} onChange={(e) => setImpactaPlazo(e.target.checked)} />
              Impacta plazo
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={!respuesta.trim() || guardando} onClick={enviarRespuesta}>
              {guardando ? "Guardando…" : "Enviar respuesta"}</button>
            <button className="btn btn-gh" onClick={() => setMostrarRespuesta(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {puedeResponder && r.estado === "Respondido" && (
        <div className="t-actions">
          <button className="btn btn-ok" onClick={() => onCerrar(r)}>Cerrar RFI</button>
        </div>
      )}
    </div>
  );
}
