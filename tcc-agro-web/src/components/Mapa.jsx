import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// --- CONFIGURAÇÃO DO ÍCONE ---
const tratorIcon = new L.Icon({
  iconUrl: '/trator.png', 
  shadowUrl: iconShadow,
  iconSize:     [50, 50], 
  iconAnchor:   [25, 25], 
  popupAnchor:  [0, -40] // Ajustei para o balão aparecer acima do trator
});

// --- FUNÇÃO DE CORES (MAPA DE CALOR) ---
const getCorPorTaxa = (taxa) => {
  const min = 0; const max = 200; 
  let valor = taxa;
  if (valor > max) valor = max;
  if (valor < min) valor = min;
  const hue = (valor / max) * 120; 
  return `hsl(${hue}, 100%, 50%)`;
}

// --- CÂMERA INTELIGENTE ---
function ControladorCamera({ lat, lon, rastro }) {
  const map = useMap()
  const tamanhoAnterior = useRef(0)

  useEffect(() => {
    if (!map) return;
    const tamanhoAtual = rastro ? rastro.length : 0;
    const diferenca = Math.abs(tamanhoAtual - tamanhoAnterior.current);

    if (diferenca > 2 && rastro.length > 1) {
      const bounds = L.latLngBounds(rastro.map(p => [p.lat, p.lon]))
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 })
    } else if (lat !== 0 && lon !== 0) {
      map.panTo([lat, lon], { animate: true, duration: 1.0 })
    }
    tamanhoAnterior.current = tamanhoAtual;
  }, [rastro, lat, lon, map])

  return null
}

export function Mapa({ lat, lon, rastro, nomeTrator, velocidade }) {
  const position = [lat || -14.2350, lon || -51.9253]

  return (
    <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
      
      <TileLayer
        url="http://mt0.google.com/vt/lyrs=y&hl=pt-br&x={x}&y={y}&z={z}"
        attribution='&copy; Google Maps'
        maxNativeZoom={20} maxZoom={22}
      />

      <ControladorCamera lat={lat} lon={lon} rastro={rastro} />

      {/* Rastro Colorido */}
      {rastro.map((ponto, index) => (
        <Circle 
          key={index}
          center={[ponto.lat, ponto.lon]}
          pathOptions={{ 
            color: getCorPorTaxa(ponto.taxa), 
            fillColor: getCorPorTaxa(ponto.taxa), 
            fillOpacity: 0.6, weight: 0 
          }}
          radius={3} 
        />
      ))}

      {/* TRATOR COM TOOLTIP (TEXTO AO PASSAR O MOUSE) */}
      {lat !== 0 && lon !== 0 && (
        <Marker position={[lat, lon]} icon={tratorIcon}>
          <Tooltip direction="top" offset={[0, -20]} opacity={1}>
             <div style={{textAlign: 'center'}}>
               <strong style={{fontSize: 14}}>🚜 {nomeTrator}</strong><br/>
               <span style={{fontSize: 12}}>⚡ {velocidade} km/h</span>
             </div>
          </Tooltip>
        </Marker>
      )}

    </MapContainer>
  )
}