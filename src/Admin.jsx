import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { useCatalogos } from "./useCatalogos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const ROL_COLOR = { Admin:"#B3462E", Supervisor:"#33586E", Ingeniero:"#2E7D4F" };

export default function Admin({ correo }) {
  const [usuarios, setUsuarios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");
  const { PROYECTOS, cargandoCatalogos } = useCatalogos();

  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    const [u, a] = await Promise.all([
      supabase.from("perfiles").select("*").order("nombre"),
      supabase.from("asignaciones").select("*"),
    ]);
    setUsuarios(u.data || []);
    setAsignaciones(a.data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const cambiarRol = async (u, rol) => {
    const { error } = await supabase.from("perfiles").update({ rol }).eq("correo", u.correo);
    if (error) { aviso("No se pudo cambiar el rol: " + error.message); return; }
    aviso(`${u.nombre} ahora es ${rol}`);
    cargar();
  };

  const eliminarUsuario = async (u) => {
    if (!confirm(`¿Eliminar a ${u.nombre} (${u.correo}) del sistema? Esto no elimina su cuenta de acceso, solo su perfil y asignaciones.`)) return;
    const { error } = await supabase.from("perfiles").delete().eq("correo", u.correo);
    if (error) { aviso("No se pudo eliminar: " + error.message); return; }
    aviso("Usuario eliminado");
    cargar();
  };

  const asignacionesDe = (correoUsuario) => asignaciones.filter((a) => a.correo === correoUsuario);

  const agregarAsignacion = async (correoUsuario, proyectoId) => {
    const p = PROYECTOS.find((x) => x[0] === Number(proyectoId));
    const { error } = await supabase.from("asignaciones").insert({
      correo: correoUsuario, proyecto_id: Number(proyectoId), proyecto: p?.[2] || "", asignado_por: correo,
    });
    if (error) {
      aviso(error.code === "23505" ? "Ese usuario ya está asignado a ese proyecto." : "No se pudo asignar: " + error.message);
      return;
    }
    aviso("Proyecto asignado");
    cargar();
  };

  const quitarAsignacion = async (a) => {
    const { error } = await supabase.from("asignaciones").delete().eq("id", a.id);
    if (error) { aviso("No se pudo quitar: " + error.message); return; }
    aviso("Asignación eliminada");
    cargar();
  };

  if (cargandoCatalogos) return <div className="empty">Cargando catálogos…</div>;

  return (
    <>
      <div className="sec-t" style={{ marginTop: 0 }}>Administración de usuarios · {usuarios.length}</div>
      {msg && <div className="saved-note">✓ {msg}</div>}

      <div style={{
        background: "#FFF2CC", border: "1px solid #E0C989", borderRadius: 4, padding: "12px 14px",
        fontSize: 12.5, color: "#7D4A00", marginBottom: 18, lineHeight: 1.5,
      }}>
        <b>Cómo funciona:</b> Admin ve y gestiona todo sin necesidad de asignación. Supervisor e Ingeniero
        solo ven los proyectos que les asignes aquí — en Reportes, Contratos, Cubicaciones, Órdenes de Cambio y RFI.
      </div>

      <button className="btn btn-amb" style={{ marginBottom: 16 }} onClick={() => setMostrarForm(!mostrarForm)}>
        {mostrarForm ? "Cancelar" : "+ Agregar usuario"}
      </button>

      {mostrarForm && (
        <FormUsuario onGuardado={(u) => { setUsuarios([...usuarios, u].sort((a, b) => a.nombre.localeCompare(b.nombre))); setMostrarForm(false); aviso("Usuario agregado"); }} />
      )}

      {cargando ? <div className="empty">Cargando…</div> : usuarios.map((u) => (
        <div key={u.correo} className="ticket" style={{ "--e": ROL_COLOR[u.rol] }}>
          <div className="t-head">
            <div>
              <div className="t-id">{u.correo}</div>
              <div className="t-proj">{u.nombre}</div>
            </div>
            <div className="stamp">{u.rol}</div>
          </div>
          <div className="t-body">
            {u.rol === "Admin" ? (
              <i>Admin ve todos los proyectos automáticamente — no necesita asignación.</i>
            ) : (
              <>
                Proyectos asignados: {asignacionesDe(u.correo).length === 0 ? (
                  <span style={{ color: "var(--rojo)" }}>ninguno — no verá nada aún</span>
                ) : asignacionesDe(u.correo).map((a) => a.proyecto).join(", ")}
              </>
            )}
          </div>

          <div className="t-actions" style={{ flexWrap: "wrap" }}>
            <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)}
              style={{ padding: "9px 10px", borderRadius: 3, border: "1px solid var(--linea)", fontSize: 13 }}>
              <option value="Admin">Admin</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Ingeniero">Ingeniero</option>
            </select>
            {u.rol !== "Admin" && (
              <button className="btn btn-gh" onClick={() => setExpandido(expandido === u.correo ? null : u.correo)}>
                {expandido === u.correo ? "Ocultar asignaciones" : "Gestionar proyectos"}
              </button>
            )}
            {u.correo !== correo && (
              <button className="btn btn-gh" onClick={() => eliminarUsuario(u)}>Eliminar usuario</button>
            )}
          </div>

          {expandido === u.correo && u.rol !== "Admin" && (
            <div style={{ padding: "0 20px 18px 26px" }}>
              {asignacionesDe(u.correo).map((a) => (
                <div key={a.id} className="cat-row">
                  <span style={{ flex: 1, fontSize: 13 }}>{a.proyecto}</span>
                  <button className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => quitarAsignacion(a)}>Quitar</button>
                </div>
              ))}
              <AgregarProyecto onAgregar={(pid) => agregarAsignacion(u.correo, pid)} PROYECTOS={PROYECTOS} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function AgregarProyecto({ onAgregar, PROYECTOS }) {
  const [proyectoId, setProyectoId] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <BuscarSelect value={proyectoId} onChange={setProyectoId} placeholder="— Elegir proyecto para asignar —"
          options={PROYECTOS.map((p) => ({ value: p[0], label: `${p[0]} · ${p[2]}` }))} />
      </div>
      <button className="btn btn-ok" disabled={!proyectoId}
        onClick={() => { onAgregar(proyectoId); setProyectoId(""); }}>Asignar</button>
    </div>
  );
}

function FormUsuario({ onGuardado }) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("Ingeniero");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const ok = correo.includes("@") && nombre.trim();

  const guardar = async () => {
    setGuardando(true); setError("");
    const { data, error: e } = await supabase.from("perfiles")
      .insert({ correo: correo.trim().toLowerCase(), nombre: nombre.trim(), rol }).select().single();
    setGuardando(false);
    if (e) {
      setError(e.code === "23505" ? "Ese correo ya está registrado." : "No se pudo guardar: " + e.message);
      return;
    }
    onGuardado(data);
  };

  return (
    <div className="form" style={{ marginBottom: 20 }}>
      <div style={{
        background: "#E3F2FD", border: "1px solid #B5D4F4", borderRadius: 4, padding: "10px 12px",
        fontSize: 12, color: "#0C447C", marginBottom: 14, lineHeight: 1.5,
      }}>
        Esto solo crea el <b>perfil y rol</b> dentro de la app. La persona también necesita una cuenta de acceso
        creada en Supabase → Authentication → Users con este mismo correo, para poder iniciar sesión.
      </div>
      <div className="fld"><label>Correo (debe coincidir con su cuenta de acceso)</label>
        <input type="email" placeholder="nombre@capcana.com" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
      <div className="fld"><label>Nombre</label>
        <input placeholder="Ej: J. Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="fld"><label>Rol</label>
        <select value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="Ingeniero">Ingeniero</option>
          <option value="Supervisor">Supervisor</option>
          <option value="Admin">Admin</option>
        </select></div>
      {error && <div className="error-msg">{error}</div>}
      <button className="btn btn-big" disabled={!ok || guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Agregar usuario"}</button>
    </div>
  );
}
