import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, ACTIVIDADES, PARTIDAS, CONTRATISTAS } from "./datos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_CONT = {
  Borrador:"#8A8578", "En licitación":"#B07D10", "Pendiente aprobación":"#33586E",
  Activo:"#2E7D4F", Suspendido:"#B3462E", Terminado:"#6B675C", Liquidado:"#1F3864",
};

export default function Contratos({ correo, perfil }) {
  const [contratos, setContratos] = useState([]);
  const [planificaciones, setPlanificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const esAdmin = perfil.rol === "Admin";

  const cargar = async () => {
    setCargando(true);
    const [c, p] = await Promise.all([
      supabase.from("contratos").select("*").order("creado", { ascending: false }),
      supabase.from("planificaciones").select("*"),
    ]);
    setContratos(c.data || []);
    setPlanificaciones(p.data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const proyectosPlanificados = planificaciones.map((p) => p.proyecto_id);

  const cambiarEstado = async (c, estado) => {
    const patch = { estado };
    if (estado === "Activo") { patch.aprobado_por = correo; patch.fecha_aprobacion = new Date().toISOString().slice(0, 10); }
    const { error } = await supabase.from("contratos").update(patch).eq("id", c.id);
    if (error) { aviso("No se pudo actualizar: " + error.message); return; }
    aviso(`Contrato ahora: ${estado}`);
    cargar();
  };

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Contratos · {contratos.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div style={{
        background: "#E3F2FD", border: "1px solid #B5D4F4", borderRadius: 4, padding: "12px 14px",
        fontSize: 12.5, color: "#0C447C", marginBottom: 18, lineHeight: 1.5,
      }}>
        Flujo: Borrador → En licitación → Pendiente aprobación → <b>Activo</b> (solo Admin puede activar).
        Solo cuando un contrato está <b>Activo</b>, el personal de obra puede reportar esa actividad.
      </div>

      {puedeEditar && (
        <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Nuevo contrato"}
        </button>
      )}

      {mostrarForm && (
        <FormContrato correo={correo} planificaciones={planificaciones}
          onGuardado={(c) => { setContratos([c, ...contratos]); setMostrarForm(false); aviso("Contrato creado en Borrador"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       contratos.length === 0 ? (
        <div className="empty">
          <b>Sin contratos aún</b>
          {puedeEditar
            ? (proyectosPlanificados.length === 0
                ? "Primero planifica un proyecto en la pestaña Planificación."
                : "Crea el primero arriba.")
            : "Aún no se han registrado contratos."}
        </div>
      ) : contratos.map((c) => (
        <ContratoCard key={c.id} c={c} puedeEditar={puedeEditar} esAdmin={esAdmin} correo={correo}
          expandido={expandido === c.id} onExpandir={() => setExpandido(expandido === c.id ? null : c.id)}
          onCambiarEstado={cambiarEstado} planificaciones={planificaciones} />
      ))}
    </>
  );
}

function FormContrato({ correo, planificaciones, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", contratista: "", numeroContrato: "", tipoContrato: "Precio unitario",
    montoContratado: "", fechaContrato: "", numeroOrdenServicio: "", fechaOrdenServicio: "",
    fechaInicio: "", fechaFin: "", observaciones: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const proyectosDisponibles = PROYECTOS.filter((p) => planificaciones.some((pl) => pl.proyecto_id === p[0]));
  const ok = f.proyectoId && f.contratista;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", contratista: f.contratista,
      numero_contrato: f.numeroContrato || null, tipo_contrato: f.tipoContrato,
      monto_contratado: Number(f.montoContratado) || 0,
      fecha_contrato: f.fechaContrato || null,
      numero_orden_servicio: f.numeroOrdenServicio || null, fecha_orden_servicio: f.fechaOrdenServicio || null,
      fecha_inicio: f.fechaInicio || null, fecha_fin: f.fechaFin || null,
      observaciones: f.observaciones || null, usuario: correo,
    };
    const { data, error: e } = await supabase.from("contratos").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  if (proyectosDisponibles.length === 0) {
    return (
      <div className="form" style={{ marginBottom: 20 }}>
        <div className="error-msg">
          Ningún proyecto tiene planificación aún. Ve a la pestaña <b>Planificación</b> y crea una primero.
        </div>
      </div>
    );
  }

  return (
    <div className="form" style={{ marginBottom: 20 }}>
      <div className="fld"><label>Proyecto (solo planificados)</label>
        <BuscarSelect value={f.proyectoId} onChange={(v) => setF({ ...f, proyectoId: v })}
          placeholder="— Seleccionar proyecto —"
          options={proyectosDisponibles.map((p) => ({ value: p[0], label: `${p[0]} · ${p[2]}` }))} /></div>
      <div className="fld"><label>Contratista</label>
        <BuscarSelect value={f.contratista} onChange={(v) => setF({ ...f, contratista: v })}
          placeholder="— Seleccionar contratista —"
          options={CONTRATISTAS.map((c) => ({ value: c, label: c }))} /></div>

      <div className="sec-t" style={{ fontSize: 15 }}>Contratado y/o Adjudicado</div>
      <div className="fld"><label>Número de contrato</label>
        <input placeholder="CC-2026-001" value={f.numeroContrato} onChange={(e) => setF({ ...f, numeroContrato: e.target.value })} /></div>
      <div className="fld"><label>Fecha de contrato</label>
        <input type="date" value={f.fechaContrato} onChange={(e) => setF({ ...f, fechaContrato: e.target.value })} /></div>
      <div className="fld"><label>Número de Orden de Servicio</label>
        <input placeholder="OS-2026-001" value={f.numeroOrdenServicio} onChange={(e) => setF({ ...f, numeroOrdenServicio: e.target.value })} /></div>
      <div className="fld"><label>Fecha de Orden de Servicio</label>
        <input type="date" value={f.fechaOrdenServicio} onChange={(e) => setF({ ...f, fechaOrdenServicio: e.target.value })} /></div>

      <div className="fld"><label>Tipo de contrato</label>
        <select value={f.tipoContrato} onChange={(e) => setF({ ...f, tipoContrato: e.target.value })}>
          <option>Precio unitario</option><option>Suma alzada</option><option>Administración delegada</option>
        </select></div>
      <div className="fld"><label>Monto contratado</label>
        <input type="number" min="0" step="any" placeholder="0.00" value={f.montoContratado}
          onChange={(e) => setF({ ...f, montoContratado: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Inicio</label>
          <input type="date" value={f.fechaInicio} onChange={(e) => setF({ ...f, fechaInicio: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Fin</label>
          <input type="date" value={f.fechaFin} onChange={(e) => setF({ ...f, fechaFin: e.target.value })} /></div>
      </div>
      <div className="fld"><label>Observaciones</label>
        <textarea rows={2} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Guardar contrato (Borrador)"}</button>
    </div>
  );
}

function ContratoCard({ c: cInicial, puedeEditar, esAdmin, expandido, onExpandir, onCambiarEstado, planificaciones, correo }) {
  const [c, setC] = useState(cInicial);
  const [editando, setEditando] = useState(false);
  const [ef, setEf] = useState({
    contratista: c.contratista, numeroContrato: c.numero_contrato || "", fechaContrato: c.fecha_contrato || "",
    numeroOrdenServicio: c.numero_orden_servicio || "", fechaOrdenServicio: c.fecha_orden_servicio || "",
    tipoContrato: c.tipo_contrato, montoContratado: c.monto_contratado,
    fechaInicio: c.fecha_inicio || "", fechaFin: c.fecha_fin || "", observaciones: c.observaciones || "",
  });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  const puedeEditarEste = puedeEditar || c.usuario === correo;

  const guardarEdicion = async () => {
    setGuardandoEdit(true); setErrorEdit("");
    const { data, error } = await supabase.from("contratos").update({
      contratista: ef.contratista, numero_contrato: ef.numeroContrato || null, fecha_contrato: ef.fechaContrato || null,
      numero_orden_servicio: ef.numeroOrdenServicio || null, fecha_orden_servicio: ef.fechaOrdenServicio || null,
      tipo_contrato: ef.tipoContrato, monto_contratado: Number(ef.montoContratado) || 0,
      fecha_inicio: ef.fechaInicio || null, fecha_fin: ef.fechaFin || null, observaciones: ef.observaciones || null,
    }).eq("id", c.id).select().single();
    setGuardandoEdit(false);
    if (error) { setErrorEdit("No se pudo guardar: " + error.message); return; }
    setC(data);
    setEditando(false);
  };

  const siguienteEstado = {
    "Borrador": "En licitación",
    "En licitación": "Pendiente aprobación",
  }[c.estado];

  return (
    <div className="ticket" style={{ "--e": ESTADOS_CONT[c.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">{c.numero_contrato || "Sin número"} · {c.fecha_contrato || "—"}</div>
          <div className="t-proj">{c.proyecto}</div>
        </div>
        <div className="stamp">{c.estado}</div>
      </div>

      {!editando ? (
        <div className="t-body">
          <b>{c.contratista}</b> — {c.tipo_contrato}<br />
          Monto contratado: <span className="t-qty">${Number(c.monto_contratado).toLocaleString()}</span><br />
          {c.numero_orden_servicio && <>Orden de Servicio: {c.numero_orden_servicio}{c.fecha_orden_servicio ? ` · ${c.fecha_orden_servicio}` : ""}<br /></>}
          {c.fecha_inicio && c.fecha_fin && <>Vigencia: {c.fecha_inicio} → {c.fecha_fin}<br /></>}
          {c.aprobado_por && <>Aprobado por: {c.aprobado_por} el {c.fecha_aprobacion}<br /></>}
          {c.observaciones && <><i>“{c.observaciones}”</i><br /></>}
        </div>
      ) : (
        <div style={{ padding: "0 20px 14px 26px" }}>
          <div className="fld"><label>Contratista</label>
            <BuscarSelect value={ef.contratista} onChange={(v) => setEf({ ...ef, contratista: v })}
              placeholder="— Seleccionar contratista —" options={CONTRATISTAS.map((x) => ({ value: x, label: x }))} /></div>
          <div className="sec-t" style={{ fontSize: 14 }}>Contratado y/o Adjudicado</div>
          <div className="fld"><label>Número de contrato</label>
            <input value={ef.numeroContrato} onChange={(e) => setEf({ ...ef, numeroContrato: e.target.value })} /></div>
          <div className="fld"><label>Fecha de contrato</label>
            <input type="date" value={ef.fechaContrato} onChange={(e) => setEf({ ...ef, fechaContrato: e.target.value })} /></div>
          <div className="fld"><label>Número de Orden de Servicio</label>
            <input value={ef.numeroOrdenServicio} onChange={(e) => setEf({ ...ef, numeroOrdenServicio: e.target.value })} /></div>
          <div className="fld"><label>Fecha de Orden de Servicio</label>
            <input type="date" value={ef.fechaOrdenServicio} onChange={(e) => setEf({ ...ef, fechaOrdenServicio: e.target.value })} /></div>
          <div className="fld"><label>Tipo de contrato</label>
            <select value={ef.tipoContrato} onChange={(e) => setEf({ ...ef, tipoContrato: e.target.value })}>
              <option>Precio unitario</option><option>Suma alzada</option><option>Administración delegada</option>
            </select></div>
          <div className="fld"><label>Monto contratado</label>
            <input type="number" min="0" step="any" value={ef.montoContratado} onChange={(e) => setEf({ ...ef, montoContratado: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Inicio</label>
              <input type="date" value={ef.fechaInicio} onChange={(e) => setEf({ ...ef, fechaInicio: e.target.value })} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Fin</label>
              <input type="date" value={ef.fechaFin} onChange={(e) => setEf({ ...ef, fechaFin: e.target.value })} /></div>
          </div>
          <div className="fld"><label>Observaciones</label>
            <textarea rows={2} value={ef.observaciones} onChange={(e) => setEf({ ...ef, observaciones: e.target.value })} /></div>
          {errorEdit && <div className="error-msg">{errorEdit}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={guardandoEdit} onClick={guardarEdicion}>
              {guardandoEdit ? "Guardando…" : "Guardar cambios"}</button>
            <button className="btn btn-gh" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="t-actions" style={{ flexWrap: "wrap" }}>
        {puedeEditarEste && !editando && (
          <button className="btn btn-gh" onClick={() => setEditando(true)}>Editar</button>
        )}
        <button className="btn btn-gh" onClick={onExpandir}>
          {expandido ? "Ocultar partidas" : "Ver / agregar partidas"}
        </button>
        {puedeEditar && siguienteEstado && (
          <button className="btn btn-amb" onClick={() => onCambiarEstado(c, siguienteEstado)}>
            Pasar a "{siguienteEstado}"
          </button>
        )}
        {esAdmin && c.estado === "Pendiente aprobación" && (
          <button className="btn btn-ok" onClick={() => onCambiarEstado(c, "Activo")}>
            ✓ Aprobar y Activar
          </button>
        )}
        {c.estado === "Activo" && puedeEditar && (
          <button className="btn btn-no" onClick={() => onCambiarEstado(c, "Suspendido")}>Suspender</button>
        )}
      </div>

      {expandido && <PartidasContrato contrato={c} puedeEditar={puedeEditar} planificaciones={planificaciones} />}
    </div>
  );
}


function PartidasContrato({ contrato, puedeEditar, planificaciones }) {
  const [partidas, setPartidas] = useState([]);
  const [partidasPlanificadas, setPartidasPlanificadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const planificacion = planificaciones.find((p) => p.proyecto_id === contrato.proyecto_id);

  const cargar = async () => {
    setCargando(true);
    const promesas = [
      supabase.from("contrato_actividades").select("*").eq("contrato_id", contrato.id).order("creado"),
    ];
    if (planificacion) {
      promesas.push(supabase.from("planificacion_partidas").select("*").eq("planificacion_id", planificacion.id));
    }
    const [ca, pp] = await Promise.all(promesas);
    setPartidas(ca.data || []);
    setPartidasPlanificadas(pp?.data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [contrato.id]);

  const partidasIdsPlanificadas = partidasPlanificadas.map((p) => p.partida_id);
  const actividadesDisponibles = ACTIVIDADES.filter((a) => partidasIdsPlanificadas.includes(a[2]));

  return (
    <div style={{ padding: "0 20px 18px 26px" }}>
      {!planificacion && (
        <div style={{ fontSize: 12, color: "var(--rojo)", marginBottom: 10 }}>
          Este proyecto no tiene planificación — no se pueden agregar partidas contratadas.
        </div>
      )}
      {cargando ? <div style={{ fontSize: 12, color: "var(--tinta2)" }}>Cargando…</div> : (
        <>
          {partidas.length === 0 && <div style={{ fontSize: 12, color: "var(--tinta2)", marginBottom: 10 }}>Sin partidas contratadas aún.</div>}
          {partidas.map((p) => (
            <div key={p.id} className="cat-row">
              <span className="cat-id">{p.actividad_id}</span>
              <span style={{ flex: 1, fontSize: 13 }}>
                <b>{p.actividad}</b>{" "}
                <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
                  — {p.cantidad_contratada} {p.unidad} × ${p.precio_unitario}
                </span>
              </span>
              <span className="t-qty" style={{ fontSize: 13 }}>${Number(p.monto_contratado).toLocaleString()}</span>
            </div>
          ))}
        </>
      )}
      {puedeEditar && planificacion && (
        <>
          <button className="btn btn-gh" style={{ marginTop: 8 }} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? "Cancelar" : "+ Agregar partida"}
          </button>
          {mostrarForm && (
            <FormPartida contrato={contrato} actividadesDisponibles={actividadesDisponibles}
              onGuardado={(p) => { setPartidas([...partidas, p]); setMostrarForm(false); }} />
          )}
        </>
      )}
    </div>
  );
}

function FormPartida({ contrato, actividadesDisponibles, onGuardado }) {
  const [actividadId, setActividadId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const actSel = ACTIVIDADES.find((a) => a[0] === actividadId);
  const ok = actividadId && cantidad > 0 && precio >= 0;

  if (actividadesDisponibles.length === 0) {
    return <div className="error-msg" style={{ marginTop: 10 }}>
      No hay actividades disponibles — agrega primero las partidas correspondientes en Planificación.
    </div>;
  }

  const guardar = async () => {
    setGuardando(true); setError("");
    const fila = {
      contrato_id: contrato.id, actividad_id: actividadId, actividad: actSel?.[1] || "",
      unidad: actSel?.[3] || "", partida_id: actSel?.[2] || null,
      cantidad_contratada: Number(cantidad), precio_unitario: Number(precio),
      usuario: contrato.usuario,
    };
    const { data, error: e } = await supabase.from("contrato_actividades").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginTop: 10, background: "#fff" }}>
      <div className="fld"><label>Actividad (solo de partidas planificadas)</label>
        <BuscarSelect value={actividadId} onChange={setActividadId} placeholder="— Seleccionar actividad —"
          options={actividadesDisponibles.map((a) => ({ value: a[0], label: a[1], sub: a[0] }))} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Cantidad contratada {actSel && `(${actSel[3]})`}</label>
          <input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Precio unitario</label>
          <input type="number" min="0" step="any" value={precio} onChange={(e) => setPrecio(e.target.value)} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-ok" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Agregar partida"}</button>
    </div>
  );
}
