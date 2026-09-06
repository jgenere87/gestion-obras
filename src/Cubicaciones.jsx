import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { PROYECTOS, CONTRATISTAS } from "./datos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ESTADOS_CUB = { Borrador:"#8A8578", "En revisión":"#B07D10", Aprobada:"#2E7D4F", Rechazada:"#B3462E", Pagada:"#33586E" };
const ESTADOS_PAGO = { Pendiente:"#B07D10", "Pago parcial":"#33586E", Pagado:"#2E7D4F" };

export default function Cubicaciones({ correo, perfil }) {
  const [tab, setTab] = useState("cubicaciones");
  const [cubicaciones, setCubicaciones] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [msg, setMsg] = useState("");

  const puedeEditar = perfil.rol === "Admin" || perfil.rol === "Supervisor";
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const [cub, pag, cont] = await Promise.all([
      supabase.from("cubicaciones").select("*").order("creado", { ascending: false }),
      supabase.from("solicitudes_pago").select("*").order("creado", { ascending: false }),
      supabase.from("contratos").select("*").eq("estado", "Activo"),
    ]);
    setCubicaciones(cub.data || []);
    setPagos(pag.data || []);
    setContratos(cont.data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const aprobarCubicacion = async (c) => {
    const { error } = await supabase.from("cubicaciones").update({ estado: "Aprobada" }).eq("id", c.id);
    if (error) { aviso("No se pudo aprobar: " + error.message); return; }
    aviso("Cubicación aprobada");
    cargar();
  };

  const rechazarCubicacion = async (c) => {
    const { error } = await supabase.from("cubicaciones").update({ estado: "Rechazada" }).eq("id", c.id);
    if (error) { aviso("No se pudo rechazar: " + error.message); return; }
    aviso("Cubicación rechazada");
    cargar();
  };

  const crearSolicitudPago = async (c) => {
    // Evita duplicados: si ya existe una solicitud para esta cubicación, no crea otra
    const yaExiste = pagos.some((p) => p.cubicacion_id === c.id);
    if (yaExiste) { aviso("Ya existe una solicitud de pago para esta cubicación."); return; }
    const fila = {
      cubicacion_id: c.id, proyecto: c.proyecto, contratista: c.contratista,
      monto_solicitado: c.monto_neto, usuario: correo,
    };
    const { error } = await supabase.from("solicitudes_pago").insert(fila);
    if (error) { aviso("No se pudo crear la solicitud: " + error.message); return; }
    aviso("Solicitud de pago creada");
    cargar();
  };

  const eliminarPago = async (p) => {
    if (!confirm("¿Eliminar esta solicitud de pago? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("solicitudes_pago").delete().eq("id", p.id);
    if (error) { aviso("No se pudo eliminar: " + error.message); return; }
    aviso("Solicitud eliminada");
    cargar();
  };

  const registrarPago = async (p, monto) => {
    const nuevoPagado = Number(p.monto_pagado) + Number(monto);
    const aprobado = p.monto_aprobado ?? p.monto_solicitado;
    const estado = nuevoPagado >= aprobado ? "Pagado" : "Pago parcial";
    const { error } = await supabase.from("solicitudes_pago")
      .update({ monto_pagado: nuevoPagado, estado_pago: estado, fecha_pago: new Date().toISOString().slice(0,10) })
      .eq("id", p.id);
    if (error) { aviso("No se pudo registrar el pago: " + error.message); return; }
    aviso("Pago registrado");
    cargar();
  };

  return (
    <>
      <div className="chips">
        <button className={`chip ${tab === "cubicaciones" ? "on" : ""}`} onClick={() => setTab("cubicaciones")}>Cubicaciones</button>
        <button className={`chip ${tab === "pagos" ? "on" : ""}`} onClick={() => setTab("pagos")}>Pagos</button>
      </div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      {tab === "cubicaciones" && (
        <>
          {puedeEditar && (
            <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
              {mostrarForm ? "Cancelar" : "+ Nueva cubicación"}
            </button>
          )}
          {mostrarForm && (
            <FormCubicacion correo={correo} contratos={contratos}
              onGuardado={(c) => { setCubicaciones([c, ...cubicaciones]); setMostrarForm(false); aviso("Cubicación creada"); }} />
          )}
          {cargando ? <div className="empty">Cargando…</div> :
           cubicaciones.length === 0 ? (
            <div className="empty"><b>Sin cubicaciones aún</b>{puedeEditar ? "Crea la primera arriba." : "Aún no hay cubicaciones registradas."}</div>
          ) : cubicaciones.map((c) => (
            <CubicacionCard key={c.id} c={c} puedeEditar={puedeEditar} correo={correo}
              pagos={pagos} onAprobar={aprobarCubicacion} onRechazar={rechazarCubicacion}
              onCrearPago={crearSolicitudPago} onCambio={cargar} />
          ))}
        </>
      )}

      {tab === "pagos" && (
        <>
          {cargando ? <div className="empty">Cargando…</div> :
           pagos.length === 0 ? (
            <div className="empty"><b>Sin solicitudes de pago</b>Se generan desde una cubicación aprobada.</div>
          ) : pagos.map((p) => (
            <PagoCard key={p.id} p={p} puedeEditar={puedeEditar} onPagar={registrarPago} onEliminar={eliminarPago} />
          ))}
        </>
      )}
    </>
  );
}

function FormCubicacion({ correo, contratos, onGuardado }) {
  const [f, setF] = useState({
    proyectoId: "", contratoId: "", contratista: "", periodoDesde: "", periodoHasta: "",
    montoBruto: "", porcRetencion: "5",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = f.proyectoId && f.contratista && f.periodoDesde && f.periodoHasta && f.montoBruto > 0;

  const guardar = async () => {
    setGuardando(true); setError("");
    const p = PROYECTOS.find((x) => x[0] === Number(f.proyectoId));
    const fila = {
      proyecto_id: Number(f.proyectoId), proyecto: p?.[2] || "",
      contrato_id: f.contratoId || null, contratista: f.contratista,
      periodo_desde: f.periodoDesde, periodo_hasta: f.periodoHasta,
      monto_bruto: Number(f.montoBruto), porc_retencion: Number(f.porcRetencion) / 100,
      usuario: correo,
    };
    const { data, error: e } = await supabase.from("cubicaciones").insert(fila).select().single();
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
      <div className="fld"><label>Contratista</label>
        <BuscarSelect value={f.contratista} onChange={(v) => setF({ ...f, contratista: v })}
          placeholder="— Seleccionar contratista —"
          options={CONTRATISTAS.map((c) => ({ value: c, label: c }))} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Período desde</label>
          <input type="date" value={f.periodoDesde} onChange={(e) => setF({ ...f, periodoDesde: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>Período hasta</label>
          <input type="date" value={f.periodoHasta} onChange={(e) => setF({ ...f, periodoHasta: e.target.value })} /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="fld" style={{ flex: 1 }}><label>Monto bruto</label>
          <input type="number" min="0" step="any" value={f.montoBruto} onChange={(e) => setF({ ...f, montoBruto: e.target.value })} /></div>
        <div className="fld" style={{ flex: 1 }}><label>% Retención</label>
          <input type="number" min="0" max="100" step="any" value={f.porcRetencion} onChange={(e) => setF({ ...f, porcRetencion: e.target.value })} /></div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Guardar cubicación"}</button>
    </div>
  );
}

function CubicacionCard({ c: cInicial, puedeEditar, correo, pagos, onAprobar, onRechazar, onCrearPago, onCambio }) {
  const [c, setC] = useState(cInicial);
  const [editando, setEditando] = useState(false);
  const [ef, setEf] = useState({
    periodoDesde: c.periodo_desde, periodoHasta: c.periodo_hasta,
    montoBruto: c.monto_bruto, porcRetencion: c.porc_retencion * 100,
  });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  const puedeEditarEste = puedeEditar || c.usuario === correo;

  const guardarEdicion = async () => {
    setGuardandoEdit(true); setErrorEdit("");
    const { data, error } = await supabase.from("cubicaciones").update({
      periodo_desde: ef.periodoDesde, periodo_hasta: ef.periodoHasta,
      monto_bruto: Number(ef.montoBruto), porc_retencion: Number(ef.porcRetencion) / 100,
    }).eq("id", c.id).select().single();
    setGuardandoEdit(false);
    if (error) { setErrorEdit("No se pudo guardar: " + error.message); return; }
    setC(data);
    setEditando(false);
    onCambio();
  };

  const enviarRevision = async () => {
    await supabase.from("cubicaciones").update({ estado: "En revisión" }).eq("id", c.id);
    setC({ ...c, estado: "En revisión" });
    onCambio();
  };

  return (
    <div className="ticket" style={{ "--e": ESTADOS_CUB[c.estado] }}>
      <div className="t-head">
        <div>
          <div className="t-id">{c.periodo_desde} → {c.periodo_hasta}</div>
          <div className="t-proj">{c.proyecto}</div>
        </div>
        <div className="stamp">{c.estado}</div>
      </div>

      {!editando ? (
        <div className="t-body">
          <b>{c.contratista}</b><br />
          Bruto: ${Number(c.monto_bruto).toLocaleString()} · Retención: {(c.porc_retencion * 100).toFixed(0)}%<br />
          Neto a cobrar: <span className="t-qty">${Number(c.monto_neto).toLocaleString()}</span>
        </div>
      ) : (
        <div style={{ padding: "0 20px 14px 26px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Período desde</label>
              <input type="date" value={ef.periodoDesde} onChange={(e) => setEf({ ...ef, periodoDesde: e.target.value })} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Período hasta</label>
              <input type="date" value={ef.periodoHasta} onChange={(e) => setEf({ ...ef, periodoHasta: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Monto bruto</label>
              <input type="number" min="0" step="any" value={ef.montoBruto} onChange={(e) => setEf({ ...ef, montoBruto: e.target.value })} /></div>
            <div className="fld" style={{ flex: 1 }}><label>% Retención</label>
              <input type="number" min="0" max="100" step="any" value={ef.porcRetencion} onChange={(e) => setEf({ ...ef, porcRetencion: e.target.value })} /></div>
          </div>
          {errorEdit && <div className="error-msg">{errorEdit}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ok" disabled={guardandoEdit} onClick={guardarEdicion}>
              {guardandoEdit ? "Guardando…" : "Guardar cambios"}</button>
            <button className="btn btn-gh" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {puedeEditar && !editando && (
        <div className="t-actions">
          {puedeEditarEste && (
            <button className="btn btn-gh" onClick={() => setEditando(true)}>Editar</button>
          )}
          {c.estado === "Borrador" && (
            <button className="btn btn-amb" onClick={enviarRevision}>Enviar a revisión</button>
          )}
          {c.estado === "En revisión" && <>
            <button className="btn btn-ok" onClick={() => onAprobar(c)}>Aprobar</button>
            <button className="btn btn-no" onClick={() => onRechazar(c)}>Rechazar</button>
          </>}
          {c.estado === "Aprobada" && (
            pagos.some((p) => p.cubicacion_id === c.id) ? (
              <span style={{ fontSize: 12, color: "var(--tinta2)", alignSelf: "center" }}>
                Ya tiene solicitud de pago generada
              </span>
            ) : (
              <button className="btn btn-amb" onClick={() => onCrearPago(c)}>Generar solicitud de pago</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function PagoCard({ p, puedeEditar, onPagar, onEliminar }) {
  const [montoPago, setMontoPago] = useState("");
  return (
    <div className="ticket" style={{ "--e": ESTADOS_PAGO[p.estado_pago] }}>
      <div className="t-head">
        <div>
          <div className="t-id">Solicitud · {p.fecha_solicitud}</div>
          <div className="t-proj">{p.proyecto}</div>
        </div>
        <div className="stamp">{p.estado_pago}</div>
      </div>
      <div className="t-body">
        <b>{p.contratista}</b><br />
        Solicitado: ${Number(p.monto_solicitado).toLocaleString()}
        {p.monto_aprobado != null && <> · Aprobado: ${Number(p.monto_aprobado).toLocaleString()}</>}<br />
        Pagado: ${Number(p.monto_pagado).toLocaleString()} ·{" "}
        <span className="t-qty">Saldo: ${Number(p.saldo_pendiente).toLocaleString()}</span>
      </div>
      {puedeEditar && p.estado_pago !== "Pagado" && (
        <div className="t-actions" style={{ gap: 8, alignItems: "center" }}>
          <input type="number" min="0" step="any" placeholder="Monto a pagar" value={montoPago}
            onChange={(e) => setMontoPago(e.target.value)}
            style={{ width: 140, border: "1px solid var(--linea)", borderRadius: 3, padding: "9px 10px", fontSize: 14 }} />
          <button className="btn btn-ok" disabled={!(montoPago > 0)}
            onClick={() => { onPagar(p, montoPago); setMontoPago(""); }}>Registrar pago</button>
          {Number(p.monto_pagado) === 0 && (
            <button className="btn btn-gh" onClick={() => onEliminar(p)}>Eliminar</button>
          )}
        </div>
      )}
    </div>
  );
}
