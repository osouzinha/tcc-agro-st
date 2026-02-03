import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'

const tractorIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2332/2332139.png',
  iconSize: [45, 45],
  iconAnchor: [22, 44],
  popupAnchor: [0, -45]
})

function RecenterAutomatically({ lat, lon }) {
  const map = useMap()
  useEffect(() => {
    if (lat !== 0 && lon !== 0) {
      map.setView([lat, lon], map.getZoom())
    }
  }, [lat, lon, map])
  return null
}

// FUNÇÃO QUE ESCOLHE A COR BASEADA NA TAXA (META = 100 L/ha)
// Você pode ajustar esses valores conforme sua Meta real
function getColor(taxa) {
  if (taxa < 10) return '#bdc3c7' // Cinza (Parado ou desligado)
  if (taxa < 90) return '#f1c40f' // Amarelo (Aplicando Pouco)
  if (taxa > 110) return '#e74c3c' // Vermelho (Aplicando Muito)
  return '#2ecc71'                // Verde (Ideal: entre 90 e 110)
}

export function Mapa({ lat, lon, rastro }) {
  const posicaoInicial = (lat !== 0 && lon !== 0) ? [lat, lon] : [-15.79, -47.88]
  const zoomInicial = (lat !== 0 && lon !== 0) ? 18 : 4

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer center={posicaoInicial} zoom={zoomInicial} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        
        {/* MAPA DE SATÉLITE */}
        <TileLayer
          url="http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution='&copy; Google Maps'
        />

        {/* --- DESENHO DO RASTRO COLORIDO --- */}
        {rastro && rastro.map((ponto, index) => (
          <CircleMarker 
            key={index}
            center={[ponto.lat, ponto.lon]}
            radius={4} // Tamanho da bolinha
            pathOptions={{ 
              color: getColor(ponto.taxa), // Cor da borda
              fillColor: getColor(ponto.taxa), // Cor do preenchimento
              fillOpacity: 0.7,
              stroke: false // Sem borda grossa
            }}
          >
            <Popup>
              Taxa: {ponto.taxa.toFixed(1)} L/ha <br/>
              Lat: {ponto.lat.toFixed(5)} <br/>
              Lon: {ponto.lon.toFixed(5)}
            </Popup>
          </CircleMarker>
        ))}

        {/* MARCADOR DO TRATOR ATUAL */}
        {lat !== 0 && lon !== 0 && (
          <Marker position={[lat, lon]} icon={tractorIcon} zIndexOffset={1000}>
            <Popup>Trator Operando Aqui!</Popup>
          </Marker>
        )}

        <RecenterAutomatically lat={lat} lon={lon} />
      </MapContainer>
    </div>
  )
}