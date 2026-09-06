import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, PARTIDAS } from "./datos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_PLAN = { Planificado:"#33586E", "En contratación":"#B07D10", Contratado:"#2E7D4F", Cerrado:"#6B675C" };

export default function Planificacion({ correo, perfil }) {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("planificaciones").select("*").order("creado", { ascending: false });
    setPlanes(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Planificación de proyectos · {planes.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div style={{
        background: "#E3F2FD", border: "1px solid #B5D4F4", borderRadius: 4, padding: "12px 14px",
        fontSize: 12.5, color: "#0C447C", marginBottom: 18, lineHeight: 1.5,
      }}>
        Este es el primer paso del flujo: planificar presupuesto, fechas y partidas antes de contratar.
        Sin esto, un proyecto no puede pasar a Contratación.
      </div>

      {puedeEditar && (
        <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Planificar proyecto"}
        </button>
      )}

      {mostrarForm && (
        <FormPlanificacion correo={correo} planesExistentes={planes}
          onGuardado={(p) => { setPlanes([p, ...planes]); setMostrarForm(false); aviso("Proyecto planificado"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       planes.length === 0 ? (
        <div className="empty"><b>Sin proyectos planificados</b>{puedeEditar ? "Crea el primero arriba." : "Aún no se ha planificado ningún proyecto asignado a ti."}</div>
      ) : planes.map((p) => (
        <PlanCard key={p.id} p={p} puedeEditar={puedeEditar}
          expandido={expandido === p.id} onExpandir={() => setExpandido(expandido === p.id ? null : p.id)} />
      ))}
    </>
  );
}

function FormPlanificacion({ correo, planesExistentes, onGuardado }) {
  const [f, setF] = useState({ proyectoId: "", presupuesto: "", fechaInicio: "", fechaFin: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const yaExiste = (pid) => planesExistentes.some((p) => p.proyecto_id === Number(pid));
  const ok = f.proyectoId && !yaExiste(f.proyectoId) && f.presupuesto > 0;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", presupuesto: Number(f.presupuesto),
      fecha_inicio: f.fechaInicio || null, fecha_fin: f.fechaFin || null, usuario: correo,
    };
    const { data, error: e } = await supabase.from("planificaciones").insert(fila).select().single();
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
      {f.proyectoId && yaExiste(f.proyectoId) && (
        <div className="error-msg">Este proyecto ya tiene una planificación. Ábrela abajo para agregar partidas.</div>
      )}
      <div className="fld"><label>Presupuesto total</label>
        <input type="number" min="0" step="any" placeholder="0.00" value={f.presupuesto}
          onChange={(e) => setF({ ...f, presupuesto: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Fecha de inicio</label>
          <input type="date" value={f.fechaInicio} onChange={(e) => setF({ ...f, fechaInicio: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Fecha de fin</label>
          <input type="date" value={f.fechaFin} onChange={(e) => setF({ ...f, fechaFin: e.target.value })} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Guardar planificación"}</button>
    </div>
  );
}

function PlanCard({ p, puedeEditar, expandido, onExpandir }) {
  return (
    <div className="ticket" style={{ "--e": ESTADOS_PLAN[p.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">Presupuesto: ${Number(p.presupuesto).toLocaleString()}</div>
          <div className="t-proj">{p.proyecto}</div>
        </div>
        <div className="stamp">{p.estado}</div>
      </div>
      <div className="t-body">
        {p.fecha_inicio && p.fecha_fin && <>Vigencia planificada: {p.fecha_inicio} → {p.fecha_fin}<br /></>}
        <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{p.usuario}</span>
      </div>
      <div className="t-actions" style={{ paddingTop: 0 }}>
        <button className="btn btn-gh" onClick={onExpandir}>
          {expandido ? "Ocultar partidas" : "Ver / agregar partidas planificadas"}
        </button>
      </div>
      {expandido && <PartidasPlanificadas planificacion={p} puedeEditar={puedeEditar} />}
    </div>
  );
}

function PartidasPlanificadas({ planificacion, puedeEditar }) {
  const [partidas, setPartidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [partidaId, setPartidaId] = useState("");

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("planificacion_partidas").select("*")
      .eq("planificacion_id", planificacion.id).order("creado");
    setPartidas(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [planificacion.id]);

  const yaAgregada = (pid) => partidas.some((p) => p.partida_id === Number(pid));

  const agregar = async () => {
    if (!partidaId || yaAgregada(partidaId)) return;
    const pt = PARTIDAS.find((x) => x[0] === Number(partidaId));
    const { error } = await supabase.from("planificacion_partidas").insert({
      planificacion_id: planificacion.id, partida_id: Number(partidaId),
      componente: pt[1], entregable: pt[2], paquete: pt[3], usuario: planificacion.usuario,
    });
    if (!error) { setPartidaId(""); cargar(); }
  };

  const quitar = async (id) => {
    await supabase.from("planificacion_partidas").delete().eq("id", id);
    cargar();
  };

  return (
    <div style={{ padding: "0 20px 18px 26px" }}>
      {cargando ? <div style={{ fontSize: 12, color: "var(--tinta2)" }}>Cargando…</div> : (
        <>
          {partidas.length === 0 && <div style={{ fontSize: 12, color: "var(--tinta2)", marginBottom: 10 }}>Sin partidas planificadas aún.</div>}
          {partidas.map((p) => (
            <div key={p.id} className="cat-row">
              <span style={{ flex: 1, fontSize: 13 }}>
                <b>{p.paquete}</b>{" "}
                <span style={{ color: "var(--tinta2)", fontSize: 12 }}>— {p.componente} / {p.entregable}</span>
              </span>
              {puedeEditar && <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => quitar(p.id)}>Quitar</button>}
            </div>
          ))}
        </>
      )}
      {puedeEditar && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <BuscarSelect value={partidaId} onChange={setPartidaId} placeholder="— Elegir partida a planificar —"
              options={PARTIDAS.filter((p) => !yaAgregada(p[0])).map((p) => ({ value: p[0], label: p[3], sub: `${p[1]} → ${p[2]}` }))} />
          </div>
          <button className="btn btn-ok" disabled={!partidaId} onClick={agregar}>Agregar</button>
        </div>
      )}
    </div>
  );
}
