import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { useCatalogos } from "./useCatalogos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_PLAN = { Planificado:"#33586E", "En contratación":"#B07D10", Contratado:"#2E7D4F", Cerrado:"#6B675C" };

export default function Planificacion({ correo, perfil }) {
  const [planes, setPlanes] = useState([]);
  const [partidasPorPlan, setPartidasPorPlan] = useState({}); // { planId: [partidas] }
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");
  const { PROYECTOS, PARTIDAS, cargandoCatalogos } = useCatalogos();

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("planificaciones").select("*").order("creado", { ascending: false });
    const lista = data || [];
    setPlanes(lista);
    if (lista.length > 0) {
      const { data: partidas } = await supabase.from("planificacion_partidas").select("*")
        .in("planificacion_id", lista.map((p) => p.id));
      const agrupado = {};
      (partidas || []).forEach((p) => {
        (agrupado[p.planificacion_id] ||= []).push(p);
      });
      setPartidasPorPlan(agrupado);
    }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const presupuestoTotal = (planId) =>
    (partidasPorPlan[planId] || []).reduce((s, p) => s + Number(p.monto_presupuestado), 0);

  if (cargandoCatalogos) return <div className="empty">Cargando catálogos…</div>;

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Planificación de proyectos · {planes.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div style={{
        background: "#E3F2FD", border: "1px solid #B5D4F4", borderRadius: 4, padding: "12px 14px",
        fontSize: 12.5, color: "#0C447C", marginBottom: 18, lineHeight: 1.5,
      }}>
        Planifica por paquete de trabajo: cada partida lleva su propio presupuesto y plazo.
        El presupuesto total del proyecto se calcula solo, sumando todas sus partidas.
      </div>

      {puedeEditar && (
        <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Planificar proyecto"}
        </button>
      )}

      {mostrarForm && (
        <FormPlanificacion correo={correo} planesExistentes={planes} PROYECTOS={PROYECTOS}
          onGuardado={(p) => { setPlanes([p, ...planes]); setMostrarForm(false); setExpandido(p.id); aviso("Proyecto planificado — ahora agrega sus partidas"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       planes.length === 0 ? (
        <div className="empty"><b>Sin proyectos planificados</b>{puedeEditar ? "Crea el primero arriba." : "Aún no se ha planificado ningún proyecto asignado a ti."}</div>
      ) : planes.map((p) => (
        <PlanCard key={p.id} p={p} puedeEditar={puedeEditar} PARTIDAS={PARTIDAS} PROYECTOS={PROYECTOS}
          partidas={partidasPorPlan[p.id] || []} presupuestoTotal={presupuestoTotal(p.id)}
          expandido={expandido === p.id} onExpandir={() => setExpandido(expandido === p.id ? null : p.id)}
          onCambio={cargar} />
      ))}
    </>
  );
}

function FormPlanificacion({ correo, planesExistentes, PROYECTOS, onGuardado }) {
  const [proyectoId, setProyectoId] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const yaExiste = (pid) => planesExistentes.some((p) => p.proyecto_id === Number(pid));
  const ok = proyectoId && !yaExiste(proyectoId);

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(proyectoId));
    const fila = { proyecto_id: Number(proyectoId), proyecto: p?.[2] || "", presupuesto: 0, usuario: correo };
    const { data, error: e } = await supabase.from("planificaciones").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginBottom: 20 }}>
      <div className="fld"><label>Proyecto</label>
        <BuscarSelect value={proyectoId} onChange={setProyectoId} placeholder="— Seleccionar proyecto —"
          options={PROYECTOS.map((p) => ({ value: p[0], label: `${p[0]} · ${p[2]}` }))} /></div>
      {proyectoId && yaExiste(proyectoId) && (
        <div className="error-msg">Este proyecto ya tiene una planificación. Ábrela abajo para agregar partidas.</div>
      )}
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Crear planificación"}</button>
    </div>
  );
}

function PlanCard({ p: pInicial, puedeEditar, partidas, presupuestoTotal, expandido, onExpandir, onCambio, PARTIDAS, PROYECTOS }) {
  const [p, setP] = useState(pInicial);
  const [editando, setEditando] = useState(false);
  const [proyectoId, setProyectoId] = useState(String(p.proyecto_id));
  const [estado, setEstado] = useState(p.estado);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  const guardarEdicion = async () => {
    setGuardandoEdit(true); setErrorEdit("");
    const proy = PROYECTOS.find((x) => x[0] === Number(proyectoId));
    const { data, error } = await supabase.from("planificaciones")
      .update({ proyecto_id: Number(proyectoId), proyecto: proy?.[2] || p.proyecto, estado })
      .eq("id", p.id).select().single();
    setGuardandoEdit(false);
    if (error) { setErrorEdit("No se pudo guardar: " + error.message); return; }
    setP(data); setEditando(false); onCambio();
  };

  return (
    <div className="ticket" style={{ "--e": ESTADOS_PLAN[p.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">{partidas.length} partida(s) planificada(s)</div>
          <div className="t-proj">{p.proyecto}</div>
        </div>
        <div className="stamp">{p.estado}</div>
      </div>

      {!editando ? (
        <div className="t-body">
          Presupuesto total: <span className="t-qty">${presupuestoTotal.toLocaleString()}</span>
          <br /><span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{p.usuario}</span>
        </div>
      ) : (
        <div style={{ padding: "0 20px 14px 26px" }}>
          <div className="fld"><label>Proyecto</label>
            <BuscarSelect value={proyectoId} onChange={setProyectoId} placeholder="— Seleccionar proyecto —"
              options={PROYECTOS.map((x) => ({ value: x[0], label: `${x[0]} · ${x[2]}` }))} /></div>
          <div className="fld"><label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option>Planificado</option><option>En contratación</option><option>Contratado</option><option>Cerrado</option>
            </select></div>
          {errorEdit && <div className="error-msg">{errorEdit}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={guardandoEdit} onClick={guardarEdicion}>
              {guardandoEdit ? "Guardando…" : "Guardar cambios"}</button>
            <button className="btn btn-gh" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="t-actions" style={{ paddingTop: 0 }}>
        {puedeEditar && !editando && (
          <button className="btn btn-gh" onClick={() => setEditando(true)}>Editar</button>
        )}
        <button className="btn btn-gh" onClick={onExpandir}>
          {expandido ? "Ocultar partidas" : "Ver / agregar partidas"}
        </button>
      </div>
      {expandido && <PartidasPlanificadas planificacion={p} puedeEditar={puedeEditar} onCambio={onCambio} PARTIDAS={PARTIDAS} />}
    </div>
  );
}

function PartidasPlanificadas({ planificacion, puedeEditar, onCambio, PARTIDAS }) {
  const [partidas, setPartidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("planificacion_partidas").select("*")
      .eq("planificacion_id", planificacion.id).order("creado");
    setPartidas(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [planificacion.id]);

  const yaAgregada = (pid) => partidas.some((p) => p.partida_id === Number(pid));
  const total = partidas.reduce((s, p) => s + Number(p.monto_presupuestado), 0);

  const quitar = async (id) => {
    await supabase.from("planificacion_partidas").delete().eq("id", id);
    cargar(); onCambio();
  };

  return (
    <div style={{ padding: "0 20px 18px 26px" }}>
      {cargando ? <div style={{ fontSize: 12, color: "var(--tinta2)" }}>Cargando…</div> : (
        <>
          {partidas.length === 0 && <div style={{ fontSize: 12, color: "var(--tinta2)", marginBottom: 10 }}>Sin partidas planificadas aún.</div>}
          {partidas.map((p) => (
            <LineaPartidaPlan key={p.id} p={p} puedeEditar={puedeEditar} onQuitar={() => quitar(p.id)} onCambio={cargar} />
          ))}
          {partidas.length > 0 && (
            <div className="saved-note" style={{ color: "var(--tinta)", fontWeight: 600 }}>
              Presupuesto total del proyecto: ${total.toLocaleString()}
            </div>
          )}
        </>
      )}
      {puedeEditar && (
        <>
          <button className="btn btn-gh" style={{ marginTop: 10 }} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? "Cancelar" : "+ Agregar partida"}
          </button>
          {mostrarForm && (
            <FormPartidaPlan planificacion={planificacion} yaAgregada={yaAgregada} PARTIDAS={PARTIDAS}
              onGuardado={() => { setMostrarForm(false); cargar(); onCambio(); }} />
          )}
        </>
      )}
    </div>
  );
}

function LineaPartidaPlan({ p, puedeEditar, onQuitar, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState(p.monto_presupuestado);
  const [fechaInicio, setFechaInicio] = useState(p.fecha_inicio || "");
  const [fechaFin, setFechaFin] = useState(p.fecha_fin || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    setGuardando(true); setError("");
    const { error: e } = await supabase.from("planificacion_partidas")
      .update({ monto_presupuestado: Number(monto), fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null })
      .eq("id", p.id);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setEditando(false); onCambio();
  };

  if (editando) {
    return (
      <div className="cat-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <span><b>{p.paquete}</b> <span style={{ color: "var(--tinta2)", fontSize: 12 }}>— {p.componente} / {p.entregable}</span></span>
        <input type="number" min="0" step="any" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto presupuestado" style={{ border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--linea)", borderRadius: 3, padding: "7px 9px", fontSize: 13 }} />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ok" style={{ padding: "6px 14px" }} disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-gh" style={{ padding: "6px 14px" }} onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-row" style={{ alignItems: "flex-start" }}>
      <span style={{ flex: 1, fontSize: 13 }}>
        <b>{p.paquete}</b>{" "}
        <span style={{ color: "var(--tinta2)", fontSize: 12 }}>— {p.componente} / {p.entregable}</span>
        <br />
        <span className="t-qty" style={{ fontSize: 13 }}>${Number(p.monto_presupuestado).toLocaleString()}</span>
        {p.fecha_inicio && p.fecha_fin && (
          <span style={{ color: "var(--tinta2)", fontSize: 12 }}> · {p.fecha_inicio} → {p.fecha_fin}</span>
        )}
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

function FormPartidaPlan({ planificacion, yaAgregada, PARTIDAS, onGuardado }) {
  const [partidaId, setPartidaId] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = partidaId && monto > 0;

  const guardar = async () => {
    setGuardando(true); setError("");
    const pt = PARTIDAS.find((x) => x[0] === Number(partidaId));
    const fila = {
      planificacion_id: planificacion.id, partida_id: Number(partidaId),
      componente: pt[1], entregable: pt[2], paquete: pt[3],
      monto_presupuestado: Number(monto), fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null,
      usuario: planificacion.usuario,
    };
    const { error: e } = await supabase.from("planificacion_partidas").insert(fila);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado();
  };

  return (
    <div className="form" style={{ marginTop: 10, background: "#fff" }}>
      <div className="fld"><label>Paquete de trabajo</label>
        <BuscarSelect value={partidaId} onChange={setPartidaId} placeholder="— Elegir partida a planificar —"
          options={PARTIDAS.filter((p) => !yaAgregada(p[0])).map((p) => ({ value: p[0], label: p[3], sub: `${p[1]} → ${p[2]}` }))} /></div>
      <div className="fld"><label>Monto presupuestado para esta partida</label>
        <input type="number" min="0" step="any" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Fecha de inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Fecha de fin</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-ok" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Agregar partida"}</button>
    </div>
  );
}
