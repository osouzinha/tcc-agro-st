import { useState, useEffect, useRef } from "react";
import { ref, onValue, set, push, remove } from "firebase/database";
import { db } from "./services/firebase";
import { Card } from "./components/Card";
import { Mapa } from "./components/Mapa";
import {
  Tractor,
  Cloud,
  Trash2,
  Upload,
  Gauge,
  Droplets,
  FileText,
  Calendar,
  Save,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import "./App.css";

function App() {
  const [tratorSelecionado, setTratorSelecionado] = useState("");
  const [listaTratores, setListaTratores] = useState([]);
  const [dados, setDados] = useState({
    taxa: 0,
    vazao: 0,
    velocidade: 0,
    lat: 0,
    lon: 0,
  });
  const [rastro, setRastro] = useState([]);
  const [modoHistorico, setModoHistorico] = useState(false);
  const [listaNuvem, setListaNuvem] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("auto");
  const [origemDados, setOrigemDados] = useState("live");

  // CONTROLE E SEGURANÇA
  const [metaAlvo, setMetaAlvo] = useState(100);
  const [lastSeen, setLastSeen] = useState(0);
  const [isOnline, setIsOnline] = useState(false);

  const rastroRef = useRef(rastro);

  // --- FUNÇÃO MOVIDA PARA CIMA PARA NÃO DAR ERRO NO REACT ---
  function executarAutoSave(pontosAtuais) {
    if (pontosAtuais.length === 0) return;
    const hoje = new Date().toISOString().split("T")[0];
    const idArquivo = `AUTO_${tratorSelecionado}_${hoje}`;
    set(ref(db, `historico/${idArquivo}`), {
      nome: `[AUTO] ${tratorSelecionado} - ${hoje}`,
      trator: tratorSelecionado,
      data: new Date().toLocaleString(),
      pontos: pontosAtuais,
      tipo: "automatico",
    });
  }

  // 1. DESCOBRIR FROTA
  useEffect(() => {
    const frotaRef = ref(db, "frota");
    onValue(frotaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const nomes = Object.keys(data);
        setListaTratores(nomes);
        if (!tratorSelecionado && nomes.length > 0)
          setTratorSelecionado(nomes[0]);
      }
    });
  }, [tratorSelecionado]);

  // 2. MONITORAMENTO + CHECK DE SEGURANÇA (HEARTBEAT)
  useEffect(() => {
    if (!tratorSelecionado) return;
    const monitorRef = ref(db, `frota/${tratorSelecionado}`);

    if (!modoHistorico) {
      setRastro([]);
      setOrigemDados("live");
    }

    const unsubscribe = onValue(monitorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDados(data);
        setLastSeen(Date.now());
        setIsOnline(true);

        if (!modoHistorico && data.lat && data.lon && data.lat !== 0) {
          const horaAtual = new Date().toLocaleTimeString();
          setRastro((prev) => {
            const ult = prev[prev.length - 1];
            if (!ult || ult.lat !== data.lat || ult.lon !== data.lon) {
              const novoRastro = [
                ...prev,
                {
                  lat: data.lat,
                  lon: data.lon,
                  taxa: data.taxa,
                  velocidade: data.velocidade,
                  hora: horaAtual,
                },
              ];
              rastroRef.current = novoRastro;
              if (origemDados === "live") executarAutoSave(novoRastro);
              return novoRastro;
            }
            return prev;
          });
        }
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tratorSelecionado, modoHistorico, origemDados]);

  // 3. WATCHDOG (CÃO DE GUARDA)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastSeen > 5000) {
        setIsOnline(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  // --- FUNÇÃO DE COMANDO SEGURA ---
  const enviarComando = () => {
    if (!tratorSelecionado) return;
    if (!isOnline) {
      alert(
        `⛔ ERRO DE SEGURANÇA\n\nO ${tratorSelecionado} está OFFLINE.\nNão é possível enviar comandos para um veículo desconectado.`,
      );
      return;
    }
    const confirmacao = confirm(
      `CONFIRMAÇÃO DE COMANDO:\n\nVeículo: ${tratorSelecionado}\nNova Meta: ${metaAlvo} L/ha\nStatus: ONLINE 🟢\n\nDeseja aplicar?`,
    );
    if (confirmacao) {
      set(ref(db, `frota/${tratorSelecionado}/comando`), {
        meta_taxa: parseFloat(metaAlvo),
        timestamp: Date.now(),
      });
      alert("✅ Comando enviado com sucesso!");
    }
  };

  // Auxiliares
  const salvarManual = () => {
    if (rastro.length === 0) return alert("Vazio!");
    const n = prompt("Nome:");
    if (n)
      push(ref(db, "historico"), {
        nome: n,
        trator: tratorSelecionado,
        data: new Date().toLocaleString(),
        pontos: rastro,
        tipo: origemDados === "csv" ? "csv" : "manual",
      });
  };

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const l = ev.target.result.split("\n");
      const n = [];
      for (let i = 1; i < l.length; i++) {
        const c = l[i].split(";");
        if (c.length >= 6) {
          const la = parseFloat(c[4]);
          const lo = parseFloat(c[5]);
          const t = parseFloat(c[3]);
          const vel = parseFloat(c[2]);

          if (!isNaN(la) && la !== 0) {
            n.push({ lat: la, lon: lo, taxa: t, velocidade: vel, hora: "CSV" });
          }
        }
      }
      setRastro(n);
      setModoHistorico(true);
      setOrigemDados("csv");
    };
    r.readAsText(f);
  };

  const abrirDaNuvem = (i) => {
    setRastro(i.pontos);
    setModoHistorico(true);
    setOrigemDados(i.tipo === "csv" ? "csv" : "live");
  };

  const apagarDaNuvem = (e, id) => {
    e.stopPropagation();
    if (confirm("Apagar?")) remove(ref(db, `historico/${id}`));
  };

  const voltarTempoReal = () => {
    setRastro([]);
    setModoHistorico(false);
    setOrigemDados("live");
  };

  // Filtro Lista
  useEffect(() => {
    onValue(ref(db, "historico"), (s) => {
      const d = s.val();
      if (d)
        setListaNuvem(
          Object.entries(d)
            .map(([k, v]) => ({ id: k, ...v }))
            .sort((a, b) => b.id.localeCompare(a.id)),
        );
      else setListaNuvem([]);
    });
  }, []);

  const listaFiltrada = listaNuvem.filter((i) =>
    abaAtiva === "auto"
      ? i.tipo === "automatico"
      : i.tipo === "csv" || i.tipo === "manual" || !i.tipo,
  );

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="logo-area">
          <Tractor size={24} color="white" />
          <h1>TCC Agro</h1>
        </div>
        <div className="header-info">
          <span>
            Usuário: <strong>Admin</strong>
          </span>
          <span>|</span>
          <span>
            Status Sistema:{" "}
            <strong style={{ color: "#2ecc71" }}>Operacional</strong>
          </span>
        </div>
      </header>

      <div className="dashboard-container">
        <div className="sidebar">
          <div className="header-content">
            {!modoHistorico && (
              <div style={{ marginTop: 5 }}>
                <label style={{ fontSize: 12, color: "#ccc" }}>VEÍCULO:</label>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <select
                    value={tratorSelecionado}
                    onChange={(e) => setTratorSelecionado(e.target.value)}
                    className="trator-select"
                  >
                    {listaTratores.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {isOnline ? (
                    <Wifi size={20} color="#2ecc71" />
                  ) : (
                    <WifiOff size={20} color="#e74c3c" />
                  )}
                </div>
              </div>
            )}

            {!modoHistorico && (
              <div
                className="painel-comando"
                style={{ opacity: isOnline ? 1 : 0.5 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 5,
                    color: "#1565C0",
                  }}
                >
                  <Settings size={14} /> <strong>Controle Remoto</strong>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <input
                    type="number"
                    value={metaAlvo}
                    onChange={(e) => setMetaAlvo(e.target.value)}
                    placeholder="L/ha"
                    className="input-comando"
                    disabled={!isOnline}
                  />
                  <button
                    onClick={enviarComando}
                    className="btn-comando"
                    disabled={!isOnline}
                  >
                    {isOnline ? "DEFINIR" : "OFFLINE"}
                  </button>
                </div>
              </div>
            )}

            {modoHistorico && (
              <div className="aviso-historico">⚠ MODO HISTÓRICO</div>
            )}
          </div>

          {!modoHistorico && (
            <div className="cards-grid">
              <Card
                titulo="Taxa (L/ha)"
                valor={dados.taxa?.toFixed(1)}
                unidade=""
                icon={<Droplets size={20} />}
                cor={dados.taxa > 0 ? "#2ecc71" : "#7f8c8d"}
              />
              <Card
                titulo="Velocidade"
                valor={dados.velocidade?.toFixed(1)}
                unidade="km/h"
                icon={<Gauge size={20} />}
              />
              <Card
                titulo="Vazão"
                valor={dados.vazao?.toFixed(1)}
                unidade="L/min"
                icon={<Droplets size={20} />}
              />
            </div>
          )}

          <hr className="divider" />
          <div className="file-manager">
            <div className="botoes-acao">
              <label className="btn-upload">
                <Upload size={14} /> CSV{" "}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  hidden
                />
              </label>
              {rastro.length > 0 && (
                <button onClick={salvarManual} className="btn-save">
                  <Save size={14} /> Salvar
                </button>
              )}
              {modoHistorico && (
                <button onClick={voltarTempoReal} className="btn-back">
                  ❌ Voltar
                </button>
              )}
            </div>
            <div className="tabs">
              <button
                className={abaAtiva === "auto" ? "tab active" : "tab"}
                onClick={() => setAbaAtiva("auto")}
              >
                <Calendar size={14} /> Diário Auto
              </button>
              <button
                className={abaAtiva === "importados" ? "tab active" : "tab"}
                onClick={() => setAbaAtiva("importados")}
              >
                <FileText size={14} /> Importados
              </button>
            </div>
            <div className="history-list">
              {listaFiltrada.map((item) => (
                <div
                  key={item.id}
                  className={`history-item ${item.tipo === "automatico" ? "auto-item" : "manual-item"}`}
                  onClick={() => abrirDaNuvem(item)}
                >
                  <div className="info">
                    <strong>{item.nome}</strong>
                    <span>📅 {item.data}</span>
                  </div>
                  <button onClick={(e) => apagarDaNuvem(e, item.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="map-area">
          <Mapa
            lat={
              modoHistorico && rastro.length > 0
                ? rastro[rastro.length - 1].lat
                : dados.lat || 0
            }
            lon={
              modoHistorico && rastro.length > 0
                ? rastro[rastro.length - 1].lon
                : dados.lon || 0
            }
            rastro={rastro}
            nomeTrator={tratorSelecionado}
            velocidade={dados.velocidade?.toFixed(1)}
            meta={metaAlvo}
          />
          <div className="map-overlay">
            <div>
              TRATOR: <strong>{tratorSelecionado || "..."}</strong>
            </div>
            <div>
              STATUS:{" "}
              <strong style={{ color: isOnline ? "#2ecc71" : "#e74c3c" }}>
                {isOnline ? "ONLINE 🟢" : "OFFLINE 🔴"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <p>
          &copy; {new Date().getFullYear()} TCC Agro - Sistema de Gestão de
          Frota e Aplicação em Taxa Variável.
        </p>
      </footer>
    </div>
  );
}
export default App;
