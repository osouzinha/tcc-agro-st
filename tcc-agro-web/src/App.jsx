import { useState, useEffect } from 'react'
import { ref, onValue, push, remove } from 'firebase/database' // Adicionado 'push' e 'remove'
import { db } from './services/firebase'
import { Card } from './components/Card'
import { Mapa } from './components/Mapa'
import { Tractor, Activity, Droplets, Signal, Upload, Cloud, Trash2, FileText } from 'lucide-react'
import './App.css'

function App() {
  const [dados, setDados] = useState({ taxa: 0, vazao: 0, velocidade: 0, lat: 0, lon: 0 })
  const [rastro, setRastro] = useState([]) 
  const [modoHistorico, setModoHistorico] = useState(false)
  
  // Lista de arquivos salvos na nuvem
  const [listaNuvem, setListaNuvem] = useState([])

  // --- 1. MONITORAMENTO EM TEMPO REAL ---
  useEffect(() => {
    const monitorRef = ref(db, 'monitor')
    onValue(monitorRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setDados(data)
        if (!modoHistorico && data.lat !== 0 && data.lon !== 0) {
          setRastro((prev) => {
            const ult = prev[prev.length - 1]
            if (!ult || (ult.lat !== data.lat || ult.lon !== data.lon)) {
              return [...prev, { lat: data.lat, lon: data.lon, taxa: data.taxa }]
            }
            return prev
          })
        }
      }
    })
  }, [modoHistorico])

  // --- 2. CARREGAR LISTA DA NUVEM (Ao iniciar) ---
  useEffect(() => {
    const historicoRef = ref(db, 'historico')
    onValue(historicoRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        // Transforma o objeto do Firebase em uma lista (array)
        const listaFormatada = Object.entries(data).map(([key, value]) => ({
          id: key,
          nome: value.nome,
          data: value.data,
          pontos: value.pontos
        }))
        setListaNuvem(listaFormatada.reverse()) // Mostra os mais recentes primeiro
      } else {
        setListaNuvem([])
      }
    })
  }, [])

  // --- 3. FUNÇÃO: SALVAR NA NUVEM ---
  const salvarNaNuvem = () => {
    if (rastro.length === 0) return alert("Não há dados para salvar!")
    
    const nomeArquivo = prompt("Dê um nome para este trabalho (Ex: Plantio Milho):")
    if (!nomeArquivo) return

    // Manda para o Firebase
    push(ref(db, 'historico'), {
      nome: nomeArquivo,
      data: new Date().toLocaleString(),
      pontos: rastro
    })
    
    alert("Salvo com sucesso na nuvem! ☁️")
  }

  // --- 4. FUNÇÃO: CARREGAR DA NUVEM ---
  const abrirDaNuvem = (item) => {
    setRastro(item.pontos)
    setModoHistorico(true)
  }

  // --- 5. FUNÇÃO: APAGAR DA NUVEM ---
  const apagarDaNuvem = (e, id) => {
    e.stopPropagation() // Evita clicar no botão e abrir o mapa ao mesmo tempo
    if (confirm("Tem certeza que quer apagar este histórico para sempre?")) {
      remove(ref(db, `historico/${id}`))
    }
  }

  // --- 6. UPLOAD LOCAL (CSV) ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const linhas = e.target.result.split('\n')
      const novosPontos = []
      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim()
        if (linha) {
          const col = linha.split(';')
          if (col.length >= 5) {
            const lat = parseFloat(col[3]), lon = parseFloat(col[4]), taxa = parseFloat(col[2])
            if (!isNaN(lat) && lat !== 0) novosPontos.push({ lat, lon, taxa })
          }
        }
      }
      setRastro(novosPontos)
      setModoHistorico(true)
    }
    reader.readAsText(file)
  }

  const voltarTempoReal = () => {
    setRastro([])
    setModoHistorico(false)
  }

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="header-content">
          <h1><Tractor size={28} color="#1565C0" /> TCC Agro</h1>
          <p className="subtitle">{modoHistorico ? "Visualizando Histórico" : "Monitoramento Ao Vivo"}</p>
        </div>

        {/* --- CONTROLES DE ARQUIVO --- */}
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Botão de Upload Local */}
          <label style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px dashed #ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
            <Upload size={16} /> Carregar CSV Local
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {/* Botão Salvar na Nuvem (Só aparece se tiver rastro na tela) */}
          {rastro.length > 0 && (
            <button onClick={salvarNaNuvem} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
              <Cloud size={16} /> Salvar Trabalho na Nuvem
            </button>
          )}

          {/* Botão Voltar */}
          {modoHistorico && (
            <button onClick={voltarTempoReal} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
              ❌ Voltar para Tempo Real
            </button>
          )}
        </div>

        {/* --- LISTA DE HISTÓRICOS SALVOS --- */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            💾 Históricos Salvos ({listaNuvem.length})
          </h3>
          
          {listaNuvem.length === 0 && <p style={{ fontSize: '12px', color: '#999' }}>Nenhum histórico salvo ainda.</p>}

          {listaNuvem.map((item) => (
            <div 
              key={item.id} 
              onClick={() => abrirDaNuvem(item)}
              style={{ background: 'white', padding: '10px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{item.nome}</div>
                <div style={{ fontSize: '11px', color: '#999' }}>{item.data}</div>
              </div>
              <button onClick={(e) => apagarDaNuvem(e, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* CARDS (Reduzidos para caber a lista) */}
        {!modoHistorico && (
          <>
            <Card titulo="Taxa (L/ha)" valor={dados.taxa?.toFixed(1)} unidade="" cor={dados.taxa > 110 ? "red" : "blue"} />
            <Card titulo="Velocidade" valor={dados.velocidade?.toFixed(1)} unidade="km/h" />
          </>
        )}

      </div>

      <div className="map-area">
        <Mapa lat={modoHistorico && rastro.length > 0 ? rastro[rastro.length-1].lat : (dados.lat || 0)} 
              lon={modoHistorico && rastro.length > 0 ? rastro[rastro.length-1].lon : (dados.lon || 0)} 
              rastro={rastro} />
      </div>
    </div>
  )
}

export default App