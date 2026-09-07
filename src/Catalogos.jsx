import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import BuscarSelect from "./BuscarSelect.jsx";

const TABS = [
  { key: "proyectos", label: "Proyectos" },
  { key: "partidas", label: "Partidas" },
  { key: "actividades", label: "Actividades" },
  { key: "contratistas", label: "Contratistas" },
  { key: "recursos", label: "Recursos" },
];

export default function Catalogos() {
  const [tab, setTab] = useState("proyectos");

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Catálogos</div>
      <div style={{
        background: "#FFF2CC", border: "1px solid #E0C989", borderRadius: 4, padding: "12px 14px",
        fontSize: 12.5, color: "#7D4A00", marginBottom: 18, lineHeight: 1.5,
      }}>
        Aquí administras las listas que aparecen en toda la app: proyectos, partidas, actividades,
        contratistas y recursos. Solo Admin puede ver y editar esta sección.
      </div>

      <div className="chips">
        {TABS.map((t) => (
          <button key={t.key} className={`chip ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "proyectos" && <CatProyectos />}
      {tab === "partidas" && <CatPartidas />}
      {tab === "actividades" && <CatActividades />}
      {tab === "contratistas" && <CatContratistas />}
      {tab === "recursos" && <CatRecursos />}
    </>
  );
}

/* Hook genérico para cargar y refrescar una tabla de catálogo */
function useCatalogo(tabla, orderBy) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from(tabla).select("*").order(orderBy);
    setItems(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  return { items, cargando, cargar, msg, aviso };
}

/* ══════════════════════ PROYECTOS ══════════════════════ */
function CatProyectos() {
  const { items, cargando, cargar, msg, aviso } = useCatalogo("cat_proyectos", "id");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [f, setF] = useState({ id: "", tipo: "", proyecto: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    const maxId = items.reduce((m, p) => Math.max(m, p.id), 0);
    setF({ id: maxId + 1, tipo: "", proyecto: "" });
    setEditando(null); setMostrarForm(true); setError("");
  };
  const abrirEditar = (p) => {
    setF({ id: p.id, tipo: p.tipo, proyecto: p.proyecto });
    setEditando(p.id); setMostrarForm(true); setError("");
  };

  const guardar = async () => {
    if (!f.tipo.trim() || !f.proyecto.trim()) return;
    setGuardando(true); setError("");
    const fila = { id: Number(f.id), tipo: f.tipo.trim(), proyecto: f.proyecto.trim() };
    const { error: e } = editando
      ? await supabase.from("cat_proyectos").update(fila).eq("id", editando)
      : await supabase.from("cat_proyectos").insert(fila);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setMostrarForm(false); cargar(); aviso(editando ? "Proyecto actualizado" : "Proyecto agregado");
  };

  const toggleActivo = async (p) => {
    await supabase.from("cat_proyectos").update({ activo: !p.activo }).eq("id", p.id);
    cargar();
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.proyecto}"? Si ya tiene reportes o contratos asociados, no se podrá eliminar.`)) return;
    const { error: e } = await supabase.from("cat_proyectos").delete().eq("id", p.id);
    if (e) { aviso("No se pudo eliminar — probablemente ya está en uso. Puedes desactivarlo en su lugar."); return; }
    aviso("Proyecto eliminado"); cargar();
  };

  return (
    <>
      {msg && <div className="saved-note">✓ {msg}</div>}
      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}>
        {mostrarForm ? "Cancelar" : "+ Nuevo proyecto"}
      </button>
      {mostrarForm && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div className="fld"><label>ID</label>
            <input type="number" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} disabled={!!editando} /></div>
          <div className="fld"><label>Tipo</label>
            <input placeholder="Ej: ARRASTRE, NUEVOS, VIALES…" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} /></div>
          <div className="fld"><label>Nombre del proyecto</label>
            <input value={f.proyecto} onChange={(e) => setF({ ...f, proyecto: e.target.value })} /></div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-ok" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
      {cargando ? <div className="empty">Cargando…</div> : items.map((p) => (
        <div key={p.id} className="cat-row" style={{ opacity: p.activo ? 1 : 0.5 }}>
          <span className="cat-id">{p.id}</span>
          <span style={{ flex: 1, fontSize: 13 }}><b>{p.proyecto}</b> <span style={{ color: "var(--tinta2)", fontSize: 12 }}>— {p.tipo}{!p.activo && " · Inactivo"}</span></span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => abrirEditar(p)}>Editar</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => toggleActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => eliminar(p)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ══════════════════════ PARTIDAS ══════════════════════ */
function CatPartidas() {
  const { items, cargando, cargar, msg, aviso } = useCatalogo("cat_partidas", "id");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [f, setF] = useState({ id: "", componente: "", entregable: "", paquete: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    const maxId = items.reduce((m, p) => Math.max(m, p.id), 0);
    setF({ id: maxId + 1, componente: "", entregable: "", paquete: "" });
    setEditando(null); setMostrarForm(true); setError("");
  };
  const abrirEditar = (p) => {
    setF({ id: p.id, componente: p.componente, entregable: p.entregable || "", paquete: p.paquete });
    setEditando(p.id); setMostrarForm(true); setError("");
  };

  const guardar = async () => {
    if (!f.componente.trim() || !f.paquete.trim()) return;
    setGuardando(true); setError("");
    const fila = { id: Number(f.id), componente: f.componente.trim(), entregable: f.entregable.trim() || null, paquete: f.paquete.trim() };
    const { error: e } = editando
      ? await supabase.from("cat_partidas").update(fila).eq("id", editando)
      : await supabase.from("cat_partidas").insert(fila);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setMostrarForm(false); cargar(); aviso(editando ? "Partida actualizada" : "Partida agregada");
  };

  const toggleActivo = async (p) => { await supabase.from("cat_partidas").update({ activo: !p.activo }).eq("id", p.id); cargar(); };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.paquete}"? Si ya tiene actividades o planificaciones asociadas, no se podrá eliminar.`)) return;
    const { error: e } = await supabase.from("cat_partidas").delete().eq("id", p.id);
    if (e) { aviso("No se pudo eliminar — probablemente ya está en uso. Puedes desactivarla en su lugar."); return; }
    aviso("Partida eliminada"); cargar();
  };

  return (
    <>
      {msg && <div className="saved-note">✓ {msg}</div>}
      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}>
        {mostrarForm ? "Cancelar" : "+ Nueva partida"}
      </button>
      {mostrarForm && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div className="fld"><label>ID</label>
            <input type="number" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} disabled={!!editando} /></div>
          <div className="fld"><label>Componente</label>
            <input placeholder="Ej: Infraestructura vial" value={f.componente} onChange={(e) => setF({ ...f, componente: e.target.value })} /></div>
          <div className="fld"><label>Entregable</label>
            <input value={f.entregable} onChange={(e) => setF({ ...f, entregable: e.target.value })} /></div>
          <div className="fld"><label>Paquete de trabajo</label>
            <input value={f.paquete} onChange={(e) => setF({ ...f, paquete: e.target.value })} /></div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-ok" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
      {cargando ? <div className="empty">Cargando…</div> : items.map((p) => (
        <div key={p.id} className="cat-row" style={{ opacity: p.activo ? 1 : 0.5 }}>
          <span className="cat-id">{p.id}</span>
          <span style={{ flex: 1, fontSize: 13 }}><b>{p.paquete}</b> <span style={{ color: "var(--tinta2)", fontSize: 12 }}>— {p.componente} / {p.entregable}{!p.activo && " · Inactiva"}</span></span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => abrirEditar(p)}>Editar</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => toggleActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => eliminar(p)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ══════════════════════ ACTIVIDADES ══════════════════════ */
function CatActividades() {
  const { items, cargando, cargar, msg, aviso } = useCatalogo("cat_actividades", "id");
  const [partidas, setPartidas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [f, setF] = useState({ id: "", nombre: "", partidaId: "", unidad: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { supabase.from("cat_partidas").select("*").order("id").then(({ data }) => setPartidas(data || [])); }, []);

  const abrirNuevo = () => {
    const nums = items.map((a) => parseInt(a.id.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    setF({ id: `A-${String(next).padStart(3, "0")}`, nombre: "", partidaId: "", unidad: "" });
    setEditando(null); setMostrarForm(true); setError("");
  };
  const abrirEditar = (a) => {
    setF({ id: a.id, nombre: a.nombre, partidaId: a.partida_id, unidad: a.unidad });
    setEditando(a.id); setMostrarForm(true); setError("");
  };

  const guardar = async () => {
    if (!f.nombre.trim() || !f.partidaId || !f.unidad.trim()) return;
    setGuardando(true); setError("");
    const fila = { id: f.id.trim(), nombre: f.nombre.trim(), partida_id: Number(f.partidaId), unidad: f.unidad.trim() };
    const { error: e } = editando
      ? await supabase.from("cat_actividades").update(fila).eq("id", editando)
      : await supabase.from("cat_actividades").insert(fila);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setMostrarForm(false); cargar(); aviso(editando ? "Actividad actualizada" : "Actividad agregada");
  };

  const toggleActivo = async (a) => { await supabase.from("cat_actividades").update({ activo: !a.activo }).eq("id", a.id); cargar(); };

  const eliminar = async (a) => {
    if (!confirm(`¿Eliminar "${a.nombre}"? Si ya tiene reportes o contratos asociados, no se podrá eliminar.`)) return;
    const { error: e } = await supabase.from("cat_actividades").delete().eq("id", a.id);
    if (e) { aviso("No se pudo eliminar — probablemente ya está en uso. Puedes desactivarla en su lugar."); return; }
    aviso("Actividad eliminada"); cargar();
  };

  const partidaMap = Object.fromEntries(partidas.map((p) => [p.id, p]));

  return (
    <>
      {msg && <div className="saved-note">✓ {msg}</div>}
      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}>
        {mostrarForm ? "Cancelar" : "+ Nueva actividad"}
      </button>
      {mostrarForm && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div className="fld"><label>Código</label>
            <input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} disabled={!!editando} /></div>
          <div className="fld"><label>Nombre de la actividad</label>
            <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div className="fld"><label>Partida a la que pertenece</label>
            <BuscarSelect value={f.partidaId} onChange={(v) => setF({ ...f, partidaId: v })} placeholder="— Seleccionar partida —"
              options={partidas.map((p) => ({ value: p.id, label: p.paquete, sub: `${p.componente} → ${p.entregable}` }))} /></div>
          <div className="fld"><label>Unidad de medida</label>
            <input placeholder="Ej: M3, ML, M2, UND…" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} /></div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-ok" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
      {cargando ? <div className="empty">Cargando…</div> : items.map((a) => (
        <div key={a.id} className="cat-row" style={{ opacity: a.activo ? 1 : 0.5 }}>
          <span className="cat-id">{a.id}</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <b>{a.nombre}</b>{" "}
            <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
              — {partidaMap[a.partida_id]?.paquete || a.partida_id}{!a.activo && " · Inactiva"}
            </span>
          </span>
          <span className="unit-tag" style={{ marginLeft: 0 }}>{a.unidad}</span>
          <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => abrirEditar(a)}>Editar</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => toggleActivo(a)}>{a.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => eliminar(a)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ══════════════════════ CONTRATISTAS ══════════════════════ */
function CatContratistas() {
  const { items, cargando, cargar, msg, aviso } = useCatalogo("cat_contratistas", "nombre");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true); setError("");
    const { error: e } = await supabase.from("cat_contratistas").insert({ nombre: nombre.trim() });
    setGuardando(false);
    if (e) { setError(e.code === "23505" ? "Ese contratista ya existe." : "No se pudo guardar: " + e.message); return; }
    setMostrarForm(false); setNombre(""); cargar(); aviso("Contratista agregado");
  };

  const toggleActivo = async (c) => { await supabase.from("cat_contratistas").update({ activo: !c.activo }).eq("nombre", c.nombre); cargar(); };

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar "${c.nombre}"? Si ya tiene contratos o reportes asociados, no se podrá eliminar.`)) return;
    const { error: e } = await supabase.from("cat_contratistas").delete().eq("nombre", c.nombre);
    if (e) { aviso("No se pudo eliminar — probablemente ya está en uso. Puedes desactivarlo en su lugar."); return; }
    aviso("Contratista eliminado"); cargar();
  };

  return (
    <>
      {msg && <div className="saved-note">✓ {msg}</div>}
      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
        {mostrarForm ? "Cancelar" : "+ Nuevo contratista"}
      </button>
      {mostrarForm && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div className="fld"><label>Nombre del contratista</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-ok" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
      {cargando ? <div className="empty">Cargando…</div> : items.map((c) => (
        <div key={c.nombre} className="cat-row" style={{ opacity: c.activo ? 1 : 0.5 }}>
          <span style={{ flex: 1, fontSize: 13 }}><b>{c.nombre}</b>{!c.activo && <span style={{ color: "var(--tinta2)", fontSize: 12 }}> · Inactivo</span>}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => toggleActivo(c)}>{c.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => eliminar(c)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ══════════════════════ RECURSOS ══════════════════════ */
function CatRecursos() {
  const { items, cargando, cargar, msg, aviso } = useCatalogo("cat_recursos", "id");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [f, setF] = useState({ id: "", nombre: "", tipo: "Equipo", unidad: "", costo: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrirNuevo = () => {
    const nums = items.map((r) => parseInt(r.id.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    setF({ id: `R-${String(next).padStart(3, "0")}`, nombre: "", tipo: "Equipo", unidad: "", costo: "" });
    setEditando(null); setMostrarForm(true); setError("");
  };
  const abrirEditar = (r) => {
    setF({ id: r.id, nombre: r.nombre, tipo: r.tipo, unidad: r.unidad, costo: r.costo_referencia });
    setEditando(r.id); setMostrarForm(true); setError("");
  };

  const guardar = async () => {
    if (!f.nombre.trim() || !f.unidad.trim()) return;
    setGuardando(true); setError("");
    const fila = { id: f.id.trim(), nombre: f.nombre.trim(), tipo: f.tipo, unidad: f.unidad.trim(), costo_referencia: Number(f.costo) || 0 };
    const { error: e } = editando
      ? await supabase.from("cat_recursos").update(fila).eq("id", editando)
      : await supabase.from("cat_recursos").insert(fila);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setMostrarForm(false); cargar(); aviso(editando ? "Recurso actualizado" : "Recurso agregado");
  };

  const toggleActivo = async (r) => { await supabase.from("cat_recursos").update({ activo: !r.activo }).eq("id", r.id); cargar(); };

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar "${r.nombre}"? Si ya está usado en reportes, no se podrá eliminar.`)) return;
    const { error: e } = await supabase.from("cat_recursos").delete().eq("id", r.id);
    if (e) { aviso("No se pudo eliminar — probablemente ya está en uso. Puedes desactivarlo en su lugar."); return; }
    aviso("Recurso eliminado"); cargar();
  };

  return (
    <>
      {msg && <div className="saved-note">✓ {msg}</div>}
      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}>
        {mostrarForm ? "Cancelar" : "+ Nuevo recurso"}
      </button>
      {mostrarForm && (
        <div className="form" style={{ marginBottom: 20 }}>
          <div className="fld"><label>Código</label>
            <input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} disabled={!!editando} /></div>
          <div className="fld"><label>Nombre</label>
            <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div className="fld"><label>Tipo</label>
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option>Equipo</option><option>Material</option><option>Trabajo</option>
            </select></div>
          <div className="fld"><label>Unidad</label>
            <input placeholder="Ej: Hr, M3, UND, Día…" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} /></div>
          <div className="fld"><label>Costo de referencia</label>
            <input type="number" min="0" step="any" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-ok" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
      {cargando ? <div className="empty">Cargando…</div> : items.map((r) => (
        <div key={r.id} className="cat-row" style={{ opacity: r.activo ? 1 : 0.5 }}>
          <span className="cat-id">{r.id}</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <b>{r.nombre}</b>{" "}
            <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
              — {r.tipo} · ref. ${r.costo_referencia}{!r.activo && " · Inactivo"}
            </span>
          </span>
          <span className="unit-tag" style={{ marginLeft: 0 }}>{r.unidad}</span>
          <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => abrirEditar(r)}>Editar</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => toggleActivo(r)}>{r.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => eliminar(r)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}
