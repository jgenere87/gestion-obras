import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { useCatalogos } from "./useCatalogos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_OC = {
  Solicitada:"#B07D10", "En revisión":"#33586E", Aprobada:"#2E7D4F",
  Rechazada:"#B3462E", "Incorporada al contrato":"#1F3864",
};

export default function OrdenesCambio({ correo, perfil }) {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [msg, setMsg] = useState("");
  const { PROYECTOS, cargandoCatalogos } = useCatalogos();

  const puedeAprobar = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from("ordenes_cambio").select("*").order("creado", { ascending: false });
    setOrdenes(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (o, estado) => {
    const patch = { estado };
    if (estado === "Aprobada" || estado === "Rechazada") {
      patch.aprobado_por = correo;
      patch.fecha_aprobacion = new Date().toISOString().slice(0, 10);
      if (estado === "Aprobada" && o.monto_aprobado == null) patch.monto_aprobado = o.monto_solicitado;
    }
    const { error } = await supabase.from("ordenes_cambio").update(patch).eq("id", o.id);
    if (error) { aviso("No se pudo actualizar: " + error.message); return; }
    aviso(`Orden ${estado.toLowerCase()}`);
    cargar();
  };

  if (cargandoCatalogos) return <div className="empty">Cargando catálogos…</div>;

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Órdenes de Cambio · {ordenes.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
        {mostrarForm ? "Cancelar" : "+ Solicitar orden de cambio"}
      </button>

      {mostrarForm && (
        <FormOC correo={correo} PROYECTOS={PROYECTOS}
          onGuardado={(o) => { setOrdenes([o, ...ordenes]); setMostrarForm(false); aviso("Orden de cambio solicitada"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> :
       ordenes.length === 0 ? (
        <div className="empty"><b>Sin órdenes de cambio</b>Crea la primera arriba si necesitas ajustar alcance, costo o plazo.</div>
      ) : ordenes.map((o) => (
        <OcCard key={o.id} o={o} puedeAprobar={puedeAprobar} correo={correo} onCambiarEstado={cambiarEstado} onCambio={cargar} />
      ))}
    </>
  );
}

function OcCard({ o: oInicial, puedeAprobar, correo, onCambiarEstado, onCambio }) {
  const [o, setO] = useState(oInicial);
  const [editando, setEditando] = useState(false);
  const [ef, setEf] = useState({
    tipoCambio: o.tipo_cambio, descripcion: o.descripcion, causa: o.causa || "",
    montoSolicitado: o.monto_solicitado, diasImpacto: o.dias_impacto,
  });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  const puedeEditarEste = puedeAprobar || o.solicitado_por === correo;

  const guardarEdicion = async () => {
    setGuardandoEdit(true); setErrorEdit("");
    const { data, error } = await supabase.from("ordenes_cambio").update({
      tipo_cambio: ef.tipoCambio, descripcion: ef.descripcion, causa: ef.causa || null,
      monto_solicitado: Number(ef.montoSolicitado) || 0, dias_impacto: Number(ef.diasImpacto) || 0,
    }).eq("id", o.id).select().single();
    setGuardandoEdit(false);
    if (error) { setErrorEdit("No se pudo guardar: " + error.message); return; }
    setO(data);
    setEditando(false);
    onCambio();
  };

  return (
    <div className="ticket" style={{ "--e": ESTADOS_OC[o.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">{o.tipo_cambio} · {o.fecha_solicitud}</div>
          <div className="t-proj">{o.proyecto}</div>
        </div>
        <div className="stamp">{o.estado}</div>
      </div>

      {!editando ? (
        <div className="t-body">
          <b>{o.descripcion}</b><br />
          {o.causa && <>Causa: {o.causa}<br /></>}
          Monto solicitado: <span className="t-qty">${Number(o.monto_solicitado).toLocaleString()}</span>
          {o.monto_aprobado != null && <> · Aprobado: ${Number(o.monto_aprobado).toLocaleString()}</>}<br />
          {o.dias_impacto > 0 && <>Impacto en plazo: {o.dias_impacto} días<br /></>}
          <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}>{o.solicitado_por}</span>
        </div>
      ) : (
        <div style={{ padding: "0 20px 14px 26px" }}>
          <div className="fld"><label>Tipo de cambio</label>
            <select value={ef.tipoCambio} onChange={(e) => setEf({ ...ef, tipoCambio: e.target.value })}>
              <option>Adicional</option><option>Deductivo</option><option>Cambio de alcance</option>
              <option>Cambio de diseño</option><option>Extensión de plazo</option>
            </select></div>
          <div className="fld"><label>Descripción del cambio</label>
            <textarea rows={2} value={ef.descripcion} onChange={(e) => setEf({ ...ef, descripcion: e.target.value })} /></div>
          <div className="fld"><label>Causa</label>
            <textarea rows={2} value={ef.causa} onChange={(e) => setEf({ ...ef, causa: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Monto solicitado</label>
              <input type="number" min="0" step="any" value={ef.montoSolicitado} onChange={(e) => setEf({ ...ef, montoSolicitado: e.target.value })} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Días de impacto</label>
              <input type="number" min="0" value={ef.diasImpacto} onChange={(e) => setEf({ ...ef, diasImpacto: e.target.value })} /></div>
          </div>
          {errorEdit && <div className="error-msg">{errorEdit}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={guardandoEdit} onClick={guardarEdicion}>
              {guardandoEdit ? "Guardando…" : "Guardar cambios"}</button>
            <button className="btn btn-gh" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {!editando && (
        <div className="t-actions" style={{ flexWrap: "wrap" }}>
          {puedeEditarEste && (
            <button className="btn btn-gh" onClick={() => setEditando(true)}>Editar</button>
          )}
          {puedeAprobar && (o.estado === "Solicitada" || o.estado === "En revisión") && (
            <>
              <button className="btn btn-ok" onClick={() => onCambiarEstado(o, "Aprobada")}>Aprobar</button>
              <button className="btn btn-no" onClick={() => onCambiarEstado(o, "Rechazada")}>Rechazar</button>
            </>
          )}
          {puedeAprobar && o.estado === "Aprobada" && (
            <button className="btn btn-amb" onClick={() => onCambiarEstado(o, "Incorporada al contrato")}>
              Incorporar al contrato
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormOC({ correo, PROYECTOS, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", tipoCambio: "Adicional", descripcion: "", causa: "",
    montoSolicitado: "", diasImpacto: "0",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = f.proyectoId && f.descripcion;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "", tipo_cambio: f.tipoCambio,
      descripcion: f.descripcion, causa: f.causa || null,
      monto_solicitado: Number(f.montoSolicitado) || 0, dias_impacto: Number(f.diasImpacto) || 0,
      solicitado_por: correo,
    };
    const { data, error: e } = await supabase.from("ordenes_cambio").insert(fila).select().single();
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
      <div className="fld"><label>Tipo de cambio</label>
        <select value={f.tipoCambio} onChange={(e) => setF({ ...f, tipoCambio: e.target.value })}>
          <option>Adicional</option><option>Deductivo</option><option>Cambio de alcance</option>
          <option>Cambio de diseño</option><option>Extensión de plazo</option>
        </select></div>
      <div className="fld"><label>Descripción del cambio</label>
        <textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
      <div className="fld"><label>Causa</label>
        <textarea rows={2} value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Monto solicitado</label>
          <input type="number" min="0" step="any" value={f.montoSolicitado} onChange={(e) => setF({ ...f, montoSolicitado: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Días de impacto</label>
          <input type="number" min="0" value={f.diasImpacto} onChange={(e) => setF({ ...f, diasImpacto: e.target.value })} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Enviando…" : "Solicitar orden de cambio"}</button>
    </div>
  );
}
