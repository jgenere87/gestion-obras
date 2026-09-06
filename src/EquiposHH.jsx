import { useState } from "react";
import { CONTRATISTAS } from "./datos.js";
import BuscarSelect from "./BuscarSelect.jsx";

const CARGOS = ["Operador","Maestro","Ayudante","Técnico","Supervisor","Otro"];
const TIPOS_EQUIPO = ["Excavadora","Volquete","Grúa","Compactador","Bomba","Andamio","Tractor","Retropala","Otro"];

/* Sección de Equipos usados — se monta dentro de FormReporte */
export function SeccionEquipos({ contratistaDefecto, equipos, setEquipos }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("Excavadora");
  const [contratista, setContratista] = useState(contratistaDefecto || "");
  const [horasTrab, setHorasTrab] = useState("");
  const [horasParadas, setHorasParadas] = useState("");
  const [causa, setCausa] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const agregar = () => {
    if (!nombre || (!horasTrab && !horasParadas)) return;
    setEquipos([...equipos, {
      equipo: nombre, tipo_equipo: tipo, contratista: contratista || null,
      horas_trabajadas: Number(horasTrab) || 0, horas_paradas: Number(horasParadas) || 0,
      causa_parada: causa || null,
    }]);
    setNombre(""); setHorasTrab(""); setHorasParadas(""); setCausa(""); setMostrar(false);
    setContratista(contratistaDefecto || "");
  };
  const quitar = (i) => setEquipos(equipos.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="sec-t" style={{ fontSize: 15 }}>Equipos utilizados</div>
      {equipos.map((e, i) => (
        <div key={i} className="cat-row" style={{ alignItems: "center" }}>
          <span className="unit-tag" style={{ marginLeft: 0 }}>{e.tipo_equipo}</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <b>{e.equipo}</b>{" "}
            <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
              — {e.contratista ? `${e.contratista} · ` : ""}{e.horas_trabajadas}h trabajadas, {e.horas_paradas}h paradas{e.causa_parada ? ` (${e.causa_parada})` : ""}
            </span>
          </span>
          <button type="button" className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => quitar(i)}>Quitar</button>
        </div>
      ))}
      {!mostrar ? (
        <button type="button" className="btn btn-gh" onClick={() => setMostrar(true)}>+ Agregar equipo</button>
      ) : (
        <div className="form" style={{ background: "#fff", padding: 14 }}>
          <div className="fld"><label>Equipo</label>
            <input placeholder="Ej: Excavadora CAT 320" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="fld"><label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_EQUIPO.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fld"><label>Contratista al que pertenece</label>
            <BuscarSelect value={contratista} onChange={setContratista} placeholder="— Seleccionar contratista —"
              options={CONTRATISTAS.map((c) => ({ value: c, label: c }))} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Horas trabajadas</label>
              <input type="number" min="0" step="any" value={horasTrab} onChange={(e) => setHorasTrab(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Horas paradas</label>
              <input type="number" min="0" step="any" value={horasParadas} onChange={(e) => setHorasParadas(e.target.value)} /></div>
          </div>
          <div className="fld"><label>Causa de parada (si aplica)</label>
            <input value={causa} onChange={(e) => setCausa(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ok" onClick={agregar}>Agregar</button>
            <button type="button" className="btn btn-gh" onClick={() => setMostrar(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Sección de Hora-Hombre — se monta dentro de FormReporte */
export function SeccionHH({ contratistaDefecto, hh, setHH }) {
  const [cargo, setCargo] = useState("Ayudante");
  const [contratista, setContratista] = useState(contratistaDefecto || "");
  const [cantPersonal, setCantPersonal] = useState("");
  const [horas, setHoras] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const agregar = () => {
    if (!cantPersonal || !horas) return;
    setHH([...hh, {
      contratista: contratista || null, cargo, cant_personal: Number(cantPersonal), horas_trabajadas: Number(horas),
    }]);
    setCantPersonal(""); setHoras(""); setMostrar(false);
    setContratista(contratistaDefecto || "");
  };
  const quitar = (i) => setHH(hh.filter((_, idx) => idx !== i));

  const totalHH = hh.reduce((s, x) => s + x.cant_personal * x.horas_trabajadas, 0);

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="sec-t" style={{ fontSize: 15 }}>Hora-hombre</div>
      {hh.map((x, i) => (
        <div key={i} className="cat-row" style={{ alignItems: "center" }}>
          <span className="unit-tag" style={{ marginLeft: 0 }}>{x.cargo}</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <b>{x.cant_personal} persona(s)</b>{" "}
            <span style={{ color: "var(--tinta2)", fontSize: 12 }}>
              — {x.contratista ? `${x.contratista} · ` : ""}{x.horas_trabajadas}h c/u = {x.cant_personal * x.horas_trabajadas} HH
            </span>
          </span>
          <button type="button" className="btn btn-gh" style={{ padding: "4px 10px" }} onClick={() => quitar(i)}>Quitar</button>
        </div>
      ))}
      {hh.length > 0 && <div className="saved-note" style={{ color: "var(--tinta)", fontWeight: 600 }}>Total: {totalHH} HH</div>}
      {!mostrar ? (
        <button type="button" className="btn btn-gh" onClick={() => setMostrar(true)}>+ Agregar cuadrilla</button>
      ) : (
        <div className="form" style={{ background: "#fff", padding: 14 }}>
          <div className="fld"><label>Cargo</label>
            <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
              {CARGOS.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="fld"><label>Contratista al que pertenece</label>
            <BuscarSelect value={contratista} onChange={setContratista} placeholder="— Seleccionar contratista —"
              options={CONTRATISTAS.map((c) => ({ value: c, label: c }))} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Cantidad de personas</label>
              <input type="number" min="1" value={cantPersonal} onChange={(e) => setCantPersonal(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Horas trabajadas</label>
              <input type="number" min="0" step="any" value={horas} onChange={(e) => setHoras(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ok" onClick={agregar}>Agregar</button>
            <button type="button" className="btn btn-gh" onClick={() => setMostrar(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
