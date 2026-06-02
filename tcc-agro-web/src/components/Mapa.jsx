import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// --- CONFIGURAÇÃO DO ÍCONE ---
const tratorIcon = new L.Icon({
  iconUrl: "/trator.png",
  shadowUrl: iconShadow,
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, -40], // Ajustei para o balão aparecer acima do trator
});

// --- FUNÇÃO DE CORES (MAPA DE CALOR) ---
const getCorPorTaxa = (taxa) => {
  const min = 0;
  const max = 200;
  let valor = taxa;
  if (valor > max) valor = max;
  if (valor < min) valor = min;
  const hue = (valor / max) * 120;
  return `hsl(${hue}, 100%, 50%)`;
};

// --- CÂMERA INTELIGENTE ---
function ControladorCamera({ lat, lon, rastro }) {
  const map = useMap();
  const tamanhoAnterior = useRef(0);

  useEffect(() => {
    if (!map) return;
    const tamanhoAtual = rastro ? rastro.length : 0;
    const diferenca = Math.abs(tamanhoAtual - tamanhoAnterior.current);

    if (diferenca > 2 && rastro.length > 1) {
      const bounds = L.latLngBounds(rastro.map((p) => [p.lat, p.lon]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else if (lat !== 0 && lon !== 0) {
      map.panTo([lat, lon], { animate: true, duration: 1.0 });
    }
    tamanhoAnterior.current = tamanhoAtual;
  }, [rastro, lat, lon, map]);

  return null;
}

export function Mapa({ lat, lon, rastro, nomeTrator, velocidade }) {
  const position = [lat || -14.235, lon || -51.9253];

  return (
    <MapContainer
      center={position}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="http://mt0.google.com/vt/lyrs=y&hl=pt-br&x={x}&y={y}&z={z}"
        attribution="&copy; Google Maps"
        maxNativeZoom={20}
        maxZoom={22}
      />

      <ControladorCamera lat={lat} lon={lon} rastro={rastro} />

      {/* Rastro Colorido com Tooltip */}
      {rastro.map((ponto, index) => (
        <Circle
          key={index}
          center={[ponto.lat, ponto.lon]}
          pathOptions={{
            color: getCorPorTaxa(ponto.taxa),
            fillColor: getCorPorTaxa(ponto.taxa),
            fillOpacity: 0.8, // Aumentei a opacidade para a cor ficar mais viva
            weight: 0,
          }}
          radius={4} // Aumentei de 3 para 4 para o mouse "acertar" a bolinha mais fácil
        >
          {/* Balão que aparece ao passar o mouse */}
          <Tooltip direction="top" opacity={0.9}>
            <div style={{ textAlign: "center", lineHeight: "1.4" }}>
              <strong style={{ color: "#2980b9" }}>💧 Taxa:</strong>{" "}
              {ponto.taxa?.toFixed(1)} L/ha
              <br />
              <strong style={{ color: "#e67e22" }}>⚡ Vel:</strong>{" "}
              {ponto.velocidade ? ponto.velocidade.toFixed(1) : "--"} km/h
              <br />
              <span style={{ fontSize: 10, color: "#7f8c8d" }}>
                🕒 {ponto.hora}
              </span>
            </div>
          </Tooltip>
        </Circle>
      ))}

      {/* TRATOR COM TOOLTIP (TEXTO AO PASSAR O MOUSE) */}
      {lat !== 0 && lon !== 0 && (
        <Marker position={[lat, lon]} icon={tratorIcon}>
          <Tooltip direction="top" offset={[0, -20]} opacity={1}>
            <div style={{ textAlign: "center" }}>
              <strong style={{ fontSize: 14 }}>🚜 {nomeTrator}</strong>
              <br />
              <span style={{ fontSize: 12 }}>⚡ {velocidade} km/h</span>
            </div>
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
