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
  popupAnchor: [0, -40],
});

// --- FUNÇÃO DE CORES (AGRONÔMICA BASEADA NA META) ---
const getCorPorTaxa = (taxa, meta) => {
  // Se a meta for zero ou não existir, deixa azul por padrão
  if (!meta || meta <= 0) return "#3498db";

  const limiteSuperior = meta * 1.1; // Passou 10% da meta
  const limiteInferior = meta * 0.9; // Faltou 10% da meta

  if (taxa > limiteSuperior) {
    return "#e74c3c"; // Vermelho: Excesso de produto
  } else if (taxa < limiteInferior) {
    return "#f1c40f"; // Amarelo: Subdosagem (Falta produto)
  } else {
    return "#2ecc71"; // Verde: Aplicação Perfeita!
  }
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

// ATENÇÃO: Adicionamos a "meta" aqui nos parâmetros (props)
export function Mapa({ lat, lon, rastro, nomeTrator, velocidade, meta }) {
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

      {/* Rastro Colorido Dinâmico */}
      {rastro.map((ponto, index) => (
        <Circle
          key={index}
          center={[ponto.lat, ponto.lon]}
          pathOptions={{
            color: getCorPorTaxa(ponto.taxa, meta), // Usando a meta para julgar a cor
            fillColor: getCorPorTaxa(ponto.taxa, meta),
            fillOpacity: 0.9,
            weight: 0,
          }}
          radius={5} // Aumentei um pouquinho mais para dar destaque
        >
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
