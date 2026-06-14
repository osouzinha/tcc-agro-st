#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <FirebaseESP32.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <LittleFS.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// --- CONFIGURAÇÕES DO SISTEMA ---
#define ID_TRATOR "Prototipo_01" 
#define API_KEY "AIzaSyCtLg3GKT4ROaF6u5YO9UZDuHwBmPUPXRI"
#define DATABASE_URL "tcc-agro-st-default-rtdb.firebaseio.com"

#define GPS_TX_PIN 27 
#define GPS_RX_PIN 26 
#define PIN_SENSOR_FLUXO 14 
#define LED_STATUS 2 

float larguraFaixa = 1.0;    
float fatorCalibracao = 22.0; 

TinyGPSPlus gps;
HardwareSerial SerialGPS(1);
WebServer server(80);
Preferences preferences; 
FirebaseData fbdo;
FirebaseData fbdoLeitura; 
FirebaseAuth auth;
FirebaseConfig config;

volatile long pulsosContados = 0;
float vazaoLPM = 0.0, velocidadeKPH = 0.0, taxaAplicacao = 0.0;
unsigned long tempoAnterior = 0;
String ssid_alvo = "", pass_alvo = "";
bool firebaseOnline = false;
unsigned long botaoPressionadoTempo = 0;
bool limpando = false;

float metaTaxaAlvo = 0.0; 

// --- VARIÁVEIS DE SIMULAÇÃO (ROTA VIRTUAL) ---
float velocidadeSimulada = 0.0;
bool modoSimulacao = false;
float simLat = -28.590000; // Ponto de partida no mapa
float simLon = -49.330000;

void IRAM_ATTR contarPulsos() { pulsosContados++; }

void gravarInterno() {
  File file = LittleFS.open("/historico.csv", "a"); 
  if (!file) return;
  String linha = String(millis()/1000) + ";" + String(vazaoLPM, 1) + ";" + String(velocidadeKPH, 1) + ";" + String(taxaAplicacao, 1) + ";";
  
  if (modoSimulacao) {
    linha += String(simLat, 6) + ";" + String(simLon, 6);
  } else if (gps.location.isValid()) {
    linha += String(gps.location.lat(), 6) + ";" + String(gps.location.lng(), 6);
  } else {
    linha += "0;0";
  }
  file.println(linha);
  file.close();
}

String obterListaRedes() {
  int n = WiFi.scanNetworks();
  String opcoes = "<option value=''>-- Selecione a Rede --</option>";
  for (int i = 0; i < n; ++i) opcoes += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + "</option>";
  return opcoes;
}

void handleDados() {
  String json = "{";
  json += "\"vazao\":" + String(vazaoLPM, 1) + ",";
  json += "\"velocidade\":" + String(velocidadeKPH, 1) + ",";
  json += "\"taxa\":" + String(taxaAplicacao, 1) + ",";
  json += "\"meta\":" + String(metaTaxaAlvo, 1);
  json += "}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<style>body{font-family:sans-serif;margin:0;padding:0;background:#f4f4f9;}";
  html += ".header{background:#1565C0;color:#fff;padding:15px;text-align:center;}";
  html += ".container{padding:15px;}";
  html += ".card{background:#fff;border-radius:8px;padding:15px;margin-bottom:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
  html += "input,select,button{padding:10px;margin:5px 0;width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;}";
  html += "button{background:#1565C0;color:white;border:none;cursor:pointer;}";
  html += "button.btn-danger{background:#e74c3c;}";
  html += "h1{margin:0;font-size:22px;} h3{margin-top:0;} .simulando{color:#e67e22;font-weight:bold;}</style>";
  
  html += "<script>";
  html += "setInterval(function(){";
  html += "fetch('/dados').then(response => response.json()).then(data => {";
  html += "document.getElementById('val_vazao').innerText = data.vazao.toFixed(1);";
  html += "document.getElementById('val_velocidade').innerText = data.velocidade.toFixed(1);";
  html += "document.getElementById('val_taxa').innerText = data.taxa.toFixed(1);";
  html += "document.getElementById('val_meta').innerText = data.meta.toFixed(1);";
  html += "});}, 1000);";
  html += "</script>";
  
  html += "</head><body>";
  html += "<div class='header'><h1>Painel TCC - " + String(ID_TRATOR) + "</h1></div>";
  html += "<div class='container'>";

  html += "<div class='card'><h3>Dados de Máquina</h3>";
  html += "<p>Vazão: <b id='val_vazao'>" + String(vazaoLPM, 1) + "</b> L/min</p>";
  html += "<p>Velocidade: <b id='val_velocidade'>" + String(velocidadeKPH, 1) + "</b> km/h " + (modoSimulacao ? "<span class='simulando'>(Simulada)</span>" : "") + "</p>";
  html += "<p>Taxa de Aplicação: <b id='val_taxa'>" + String(taxaAplicacao, 1) + "</b> L/ha</p>";
  html += "<p>Meta de Aplicação: <b id='val_meta'>" + String(metaTaxaAlvo, 1) + "</b> L/ha</p>";
  html += "</div>";

  html += "<div class='card' style='border: 2px solid #e67e22;'><h3>Simulador de Rota (Banca)</h3>";
  html += "<form action='/velocidade' method='POST'>";
  html += "<label>Injetar Velocidade Virtual (km/h):</label><br>";
  html += "<input type='number' step='0.1' name='nova_vel' value='" + String(velocidadeSimulada, 1) + "'>";
  html += "<button type='submit' style='background:#e67e22;'>Andar com o Trator</button></form>";
  if(modoSimulacao) {
    html += "<form action='/DesligarSimulacao' method='POST' style='margin-top:5px;'>";
    html += "<button type='submit' class='btn-danger'>Desligar Motor Virtual</button></form>";
  }
  html += "</div>";

  html += "<div class='card'><h3>Conexão de Roteador</h3>";
  html += "<form action='/salvar' method='POST'>";
  html += "<label>Rede Wi-Fi:</label><br>";
  html += "<select name='ssid'>" + obterListaRedes() + "</select><br>";
  html += "<label>Senha de Rede:</label><br>";
  html += "<input type='password' name='pass'><br>";
  html += "<button type='submit'>Salvar Credenciais</button></form></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void handleVelocidade() {
  if (server.hasArg("nova_vel")) {
    velocidadeSimulada = server.arg("nova_vel").toFloat();
    if (velocidadeSimulada > 0.1) modoSimulacao = true;
    else modoSimulacao = false;
    server.sendHeader("Location", "/");
    server.send(303);
  } else {
    server.send(400, "text/plain", "Erro.");
  }
}

void handleDesligarSimulacao() {
  modoSimulacao = false;
  velocidadeSimulada = 0.0;
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleSalvar() {
  if (server.hasArg("ssid") && server.hasArg("pass")) {
    String n_ssid = server.arg("ssid");
    String n_pass = server.arg("pass");
    preferences.begin("wifi_config", false);
    preferences.putString("ssid", n_ssid);
    preferences.putString("pass", n_pass);
    preferences.end();
    server.send(200, "text/html", "<h1>Dados salvos. A placa reiniciará.</h1>");
    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/html", "Erro de dados.");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_STATUS, OUTPUT);
  pinMode(0, INPUT_PULLUP);

  LittleFS.begin(true);
  
  preferences.begin("wifi_config", true);
  ssid_alvo = preferences.getString("ssid", "");
  pass_alvo = preferences.getString("pass", "");
  preferences.end();

  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX_PIN, GPS_RX_PIN);
  pinMode(PIN_SENSOR_FLUXO, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_FLUXO), contarPulsos, FALLING);

  WiFi.mode(WIFI_AP_STA); 
  
  IPAddress IP_Local(192, 168, 10, 1);    
  IPAddress IP_Gateway(192, 168, 10, 1);  
  IPAddress Subnet(255, 255, 255, 0);     
  WiFi.softAPConfig(IP_Local, IP_Gateway, Subnet);
  
  WiFi.softAP(ID_TRATOR, "stinformatica31"); 
  if (ssid_alvo.length() > 0) WiFi.begin(ssid_alvo.c_str(), pass_alvo.c_str());

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  
  server.on("/", handleRoot);
  server.on("/dados", HTTP_GET, handleDados);
  server.on("/velocidade", HTTP_POST, handleVelocidade); 
  server.on("/DesligarSimulacao", HTTP_POST, handleDesligarSimulacao); 
  server.on("/salvar", HTTP_POST, handleSalvar);
  server.begin();
}

void loop() {
  server.handleClient();
  
  if (digitalRead(0) == LOW) {
    if (botaoPressionadoTempo == 0) botaoPressionadoTempo = millis();
    if (millis() - botaoPressionadoTempo > 5000 && !limpando) {
      limpando = true;
      preferences.begin("wifi_config", false); preferences.clear(); preferences.end();
      WiFi.disconnect(true, true);
      ESP.restart();
    }
  } else { botaoPressionadoTempo = 0; }

  if (!limpando && WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS, HIGH); 
    if (!firebaseOnline) {
       Firebase.begin(&config, &auth);
       Firebase.reconnectWiFi(true);
       firebaseOnline = true;
    }
  } else {
    digitalWrite(LED_STATUS, (millis() / 500) % 2); 
    firebaseOnline = false;
  }

  while (SerialGPS.available() > 0) gps.encode(SerialGPS.read());

  if (millis() - tempoAnterior > 1000) {
    vazaoLPM = (float)pulsosContados / fatorCalibracao;
    
    if (modoSimulacao) {
      velocidadeKPH = velocidadeSimulada;
      // Trator anda diagonalmente no mapa baseado na velocidade
      simLat += (velocidadeKPH * 0.000008); 
      simLon += (velocidadeKPH * 0.000005);
    } else {
      if (gps.location.isValid()) velocidadeKPH = gps.speed.kmph(); 
      else velocidadeKPH = 0.0;
    }
    
    if (velocidadeKPH > 0.5) taxaAplicacao = (vazaoLPM * 600.0) / (velocidadeKPH * larguraFaixa);
    else taxaAplicacao = 0.0;
    
    gravarInterno();
    
    if (firebaseOnline && Firebase.ready()) {
       String caminho = "/frota/" + String(ID_TRATOR);

       Firebase.setFloat(fbdo, caminho + "/vazao", vazaoLPM);
       Firebase.setFloat(fbdo, caminho + "/velocidade", velocidadeKPH);
       Firebase.setFloat(fbdo, caminho + "/taxa", taxaAplicacao);
       Firebase.setInt(fbdo, caminho + "/ts", millis()); 

       if (modoSimulacao) {
          Firebase.setFloat(fbdo, caminho + "/lat", simLat);
          Firebase.setFloat(fbdo, caminho + "/lon", simLon);
       } else if (gps.location.isValid()) {
          Firebase.setFloat(fbdo, caminho + "/lat", gps.location.lat());
          Firebase.setFloat(fbdo, caminho + "/lon", gps.location.lng());
       }

       // Puxa a Meta de Aplicação enviada pelo botão DEFINIR do seu site
       if (Firebase.getFloat(fbdoLeitura, caminho + "/comando/meta_taxa")) {
          float novaMeta = fbdoLeitura.floatData();
          if (novaMeta > 0 && novaMeta != metaTaxaAlvo) {
             metaTaxaAlvo = novaMeta;
          }
       }
    }
    pulsosContados = 0;
    tempoAnterior = millis();
  }
}