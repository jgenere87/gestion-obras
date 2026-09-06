import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, ACTIVIDADES, CONTRATISTAS } from "./datos.js";

const ESTADOS_CONT = { Activo:"#2E7D4F", Suspendido:"#B07D10", Terminado:"#6B675C", Liquidado:"#33586E" };

export default function Contratos({ correo, perfil }) {
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor";

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("contratos").select("*").order("creado", { ascending: false });
    setContratos(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Contratos · {contratos.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      {puedeEditar && (
        <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Nuevo contrato"}
        </button>
      )}

      {mostrarForm && (
        <FormContrato correo={correo}
          onGuardado={(c) => { setContratos([c, ...contratos]); setMostrarForm(false); aviso("Contrato creado"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       contratos.length === 0 ? (
        <div className="empty"><b>Sin contratos aún</b>{puedeEditar ? "Crea el primero arriba." : "Aún no se han registrado contratos."}</div>
      ) : contratos.map((c) => (
        <ContratoCard key={c.id} c={c} puedeEditar={puedeEditar}
          expandido={expandido === c.id} onExpandir={() => setExpandido(expandido === c.id ? null : c.id)}
          onCambio={cargar} />
      ))}
    </>
  );
}

function FormContrato({ correo, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", contratista: "", numeroContrato: "", tipoContrato: "Precio unitario",
    montoContratado: "", fechaContrato: "", fechaInicio: "", fechaFin: "", observaciones: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const ok = f.proyectoId && f.contratista;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", contratista: f.contratista,
      numero_contrato: f.numeroContrato || null, tipo_contrato: f.tipoContrato,
      monto_contratado: Number(f.montoContratado) || 0,
      fecha_contrato: f.fechaContrato || null, fecha_inicio: f.fechaInicio || null, fecha_fin: f.fechaFin || null,
      observaciones: f.observaciones || null, usuario: correo,
    };
    const { data, error: e } = await supabase.from("contratos").insert(fila).select().single();
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
      <div className="fld"><label>Contratista</label>
        <select value={f.contratista} onChange={(e) => setF({ ...f, contratista: e.target.value })}>
          <option value="">— Seleccionar contratista —</option>
          {CONTRATISTAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select></div>
      <div className="fld"><label>Número de contrato</label>
        <input placeholder="CC-2026-001" value={f.numeroContrato} onChange={(e) => setF({ ...f, numeroContrato: e.target.value })} /></div>
      <div className="fld"><label>Tipo de contrato</label>
        <select value={f.tipoContrato} onChange={(e) => setF({ ...f, tipoContrato: e.target.value })}>
          <option>Precio unitario</option><option>Suma alzada</option><option>Administración delegada</option>
        </select></div>
      <div className="fld"><label>Monto contratado</label>
        <input type="number" min="0" step="any" placeholder="0.00" value={f.montoContratado}
          onChange={(e) => setF({ ...f, montoContratado: e.target.value })} /></div>
      <div className="fld"><label>Fecha de contrato</label>
        <input type="date" value={f.fechaContrato} onChange={(e) => setF({ ...f, fechaContrato: e.target.value })} /></div>
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
        {guardando ? "Guardando…" : "Guardar contrato"}</button>
    </div>
  );
}

function ContratoCard({ c, puedeEditar, expandido, onExpandir, onCambio }) {
  return (
    <div className="ticket" style={{ "--e": ESTADOS_CONT[c.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">{c.numero_contrato || "Sin número"} · {c.fecha_contrato || "—"}</div>
          <div className="t-proj">{c.proyecto}</div>
        </div>
        <div className="stamp">{c.estado}</div>
      </div>
      <div className="t-body">
        <b>{c.contratista}</b> — {c.tipo_contrato}<br />
        Monto contratado: <span className="t-qty">${Number(c.monto_contratado).toLocaleString()}</span><br />
        {c.fecha_inicio && c.fecha_fin && <>Vigencia: {c.fecha_inicio} → {c.fecha_fin}<br /></>}
        {c.observaciones && <><i>“{c.observaciones}”</i><br /></>}
      </div>
      <div className="t-actions" style={{ paddingTop: 0 }}>
        <button className="btn btn-gh" onClick={onExpandir}>
          {expandido ? "Ocultar partidas" : "Ver / agregar partidas"}
        </button>
      </div>
      {expandido && <PartidasContrato contrato={c} puedeEditar={puedeEditar} />}
    </div>
  );
}

function PartidasContrato({ contrato, puedeEditar }) {
  const [partidas, setPartidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("contrato_actividades").select("*")
      .eq("contrato_id", contrato.id).order("creado");
    setPartidas(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [contrato.id]);

  return (
    <div style={{ padding: "0 20px 18px 26px" }}>
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
      {puedeEditar && (
        <>
          <button className="btn btn-gh" style={{ marginTop: 8 }} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? "Cancelar" : "+ Agregar partida"}
          </button>
          {mostrarForm && (
            <FormPartida contrato={contrato}
              onGuardado={(p) => { setPartidas([...partidas, p]); setMostrarForm(false); }} />
          )}
        </>
      )}
    </div>
  );
}

function FormPartida({ contrato, onGuardado }) {
  const [actividadId, setActividadId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const actSel = ACTIVIDADES.find((a) => a[0] === actividadId);
  const ok = actividadId && cantidad > 0 && precio >= 0;

  const guardar = async () => {
    setGuardando(true); setError("");
    const fila = {
      contrato_id: contrato.id, actividad_id: actividadId, actividad: actSel?.[1] || "",
      unidad: actSel?.[3] || "", cantidad_contratada: Number(cantidad), precio_unitario: Number(precio),
      usuario: contrato.usuario,
    };
    const { data, error: e } = await supabase.from("contrato_actividades").insert(fila).select().single();
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginTop: 10, background: "#fff" }}>
      <div className="fld"><label>Actividad</label>
        <select value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
          <option value="">— Seleccionar actividad —</option>
          {ACTIVIDADES.map((a) => <option key={a[0]} value={a[0]}>{a[0]} · {a[1]}</option>)}
        </select></div>
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
