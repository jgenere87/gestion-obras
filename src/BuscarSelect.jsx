import { useState, useRef, useEffect } from "react";

/**
 * Selector con buscador tipo autocompletar.
 * options: array de { value, label, sub? } — sub es texto secundario opcional (gris, más chico)
 */
export default function BuscarSelect({ value, onChange, options, placeholder = "Buscar…", disabled = false }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const ref = useRef(null);

  const seleccionado = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const cerrarFuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrarFuera);
    return () => document.removeEventListener("mousedown", cerrarFuera);
  }, []);

  const filtradas = texto
    ? options.filter((o) =>
        o.label.toLowerCase().includes(texto.toLowerCase()) ||
        (o.sub || "").toLowerCase().includes(texto.toLowerCase()))
    : options;

  const elegir = (o) => { onChange(String(o.value)); setTexto(""); setAbierto(false); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className={disabled ? "fld" : ""}
        onClick={() => !disabled && setAbierto(true)}
        style={{
          border: "1px solid var(--linea)", borderRadius: 3, background: disabled ? "#F2F0EA" : "#fff",
          padding: "11px 10px", fontSize: 15, color: seleccionado ? "var(--tinta)" : "#8a8578",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
        }}
      >
        {seleccionado ? seleccionado.label : placeholder}
      </div>

      {abierto && !disabled && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          background: "#fff", border: "1px solid var(--linea)", borderRadius: 4,
          boxShadow: "0 4px 16px rgba(35,33,28,.15)", maxHeight: 280, display: "flex", flexDirection: "column",
        }}>
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe para buscar…"
            style={{ border: "none", borderBottom: "1px solid var(--linea)", padding: "10px 12px", fontSize: 14, outline: "none" }}
          />
          <div style={{ overflowY: "auto" }}>
            {filtradas.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--tinta2)" }}>Sin resultados</div>
            )}
            {filtradas.slice(0, 80).map((o) => (
              <div key={o.value} onClick={() => elegir(o)}
                style={{
                  padding: "9px 12px", cursor: "pointer", fontSize: 13.5,
                  borderBottom: "1px solid #F0EEE7",
                  background: String(o.value) === String(value) ? "#FFF2CC" : "transparent",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F5F3EC"}
                onMouseLeave={(e) => e.currentTarget.style.background = String(o.value) === String(value) ? "#FFF2CC" : "transparent"}
              >
                <b>{o.label}</b>
                {o.sub && <span style={{ color: "var(--tinta2)", fontSize: 12 }}> — {o.sub}</span>}
              </div>
            ))}
            {filtradas.length > 80 && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--tinta2)", fontFamily: "IBM Plex Mono" }}>
                +{filtradas.length - 80} más — sigue escribiendo para filtrar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
