#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <FirebaseESP32.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <LittleFS.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

#define ID_TRATOR "Pulverizador_01" 

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

void IRAM_ATTR contarPulsos() { pulsosContados++; }

void gravarInterno() {
  File file = LittleFS.open("/historico.csv", "a"); 
  if (!file) return;
  String linha = String(millis()/1000) + ";" + String(vazaoLPM, 1) + ";" + String(velocidadeKPH, 1) + ";" + String(taxaAplicacao, 1) + ";";
  if (gps.location.isValid()) linha += String(gps.location.lat(), 6) + ";" + String(gps.location.lng(), 6);
  else linha += "0;0";
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
  html += "h1{margin:0;font-size:22px;} h3{margin-top:0;}</style>";
  
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
  html += "<div class='header'><h1>Trator ST - TCC</h1></div>";
  html += "<div class='container'>";

  html += "<div class='card'><h3>Dados de Maquina</h3>";
  html += "<p>Vazao: <b id='val_vazao'>" + String(vazaoLPM, 1) + "</b> L/min</p>";
  html += "<p>Velocidade: <b id='val_velocidade'>" + String(velocidadeKPH, 1) + "</b> km/h</p>";
  html += "<p>Taxa de Aplicacao: <b id='val_taxa'>" + String(taxaAplicacao, 1) + "</b> L/ha</p>";
  html += "<p>Meta de Aplicacao: <b id='val_meta'>" + String(metaTaxaAlvo, 1) + "</b> L/ha</p>";
  html += "</div>";

  html += "<div class='card'><h3>Controle de Taxa</h3>";
  html += "<form action='/meta' method='POST'>";
  html += "<label>Definicao de Litro/Hectare:</label><br>";
  html += "<input type='number' step='0.1' name='nova_meta' value='" + String(metaTaxaAlvo, 1) + "'>";
  html += "<button type='submit'>Enviar Meta</button></form></div>";

  html += "<div class='card'><h3>Arquivos CSV</h3>";
  html += "<button onclick=\"window.location.href='/baixar'\">Transferir Arquivo</button>";
  html += "<form action='/limpar' method='POST' style='margin-top:10px;'>";
  html += "<button type='submit' class='btn-danger'>Deletar Arquivo</button></form></div>";

  html += "<div class='card'><h3>Conexao de Roteador</h3>";
  html += "<form action='/salvar' method='POST'>";
  html += "<label>Rede Wi-Fi:</label><br>";
  html += "<select name='ssid'>" + obterListaRedes() + "</select><br>";
  html += "<label>Senha de Rede:</label><br>";
  html += "<input type='password' name='pass'><br>";
  html += "<button type='submit'>Salvar Credenciais</button></form></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void handleMeta() {
  if (server.hasArg("nova_meta")) {
    metaTaxaAlvo = server.arg("nova_meta").toFloat();
    server.sendHeader("Location", "/");
    server.send(303);
  } else {
    server.send(400, "text/plain", "Erro de envio.");
  }
}

void handleBaixar() {
  File file = LittleFS.open("/historico.csv", "r");
  if (!file) {
    server.send(404, "text/plain", "Sem dados de arquivo.");
    return;
  }
  server.streamFile(file, "text/csv");
  file.close();
}

void handleLimpar() {
  LittleFS.remove("/historico.csv");
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
    
    server.send(200, "text/html", "<h1>Dados de memoria. A placa de circuito reiniciara.</h1>");
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

  if(!LittleFS.begin(true)) Serial.println("Erro LittleFS");
  
  preferences.begin("wifi_config", true);
  ssid_alvo = preferences.getString("ssid", "");
  pass_alvo = preferences.getString("pass", "");
  preferences.end();

  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX_PIN, GPS_RX_PIN);
  pinMode(PIN_SENSOR_FLUXO, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_FLUXO), contarPulsos, FALLING);

  WiFi.mode(WIFI_AP_STA); 
  WiFi.softAP(ID_TRATOR, "stinformatica31"); 
  if (ssid_alvo.length() > 0) WiFi.begin(ssid_alvo.c_str(), pass_alvo.c_str());

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  
  server.on("/", handleRoot);
  server.on("/dados", HTTP_GET, handleDados);
  server.on("/meta", HTTP_POST, handleMeta);
  server.on("/baixar", HTTP_GET, handleBaixar);
  server.on("/limpar", HTTP_POST, handleLimpar);
  server.on("/salvar", HTTP_POST, handleSalvar);
  server.begin();
  
  Serial.println("--- INICIO DE SISTEMA: " + String(ID_TRATOR) + " ---");
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
    if (gps.location.isValid()) velocidadeKPH = gps.speed.kmph(); else velocidadeKPH = 0.0;
    
    if (velocidadeKPH > 0.5) taxaAplicacao = (vazaoLPM * 600.0) / (velocidadeKPH * larguraFaixa);
    else taxaAplicacao = 0.0;
    
    gravarInterno();
    
    Serial.print("["); Serial.print(ID_TRATOR); Serial.print("] ");
    Serial.print("Vazao: "); Serial.print(vazaoLPM);
    Serial.print(" | Meta: "); Serial.println(metaTaxaAlvo);

    if (firebaseOnline && Firebase.ready()) {
       String caminho = "/frota/" + String(ID_TRATOR);

       Firebase.setFloat(fbdo, caminho + "/vazao", vazaoLPM);
       Firebase.setFloat(fbdo, caminho + "/velocidade", velocidadeKPH);
       Firebase.setFloat(fbdo, caminho + "/taxa", taxaAplicacao);
       
       Firebase.setInt(fbdo, caminho + "/ts", millis()); 

       if (gps.location.isValid()) {
          Firebase.setFloat(fbdo, caminho + "/lat", gps.location.lat());
          Firebase.setFloat(fbdo, caminho + "/lon", gps.location.lng());
       }

       if (Firebase.getFloat(fbdoLeitura, caminho + "/comando/meta_taxa")) {
          float novaMeta = fbdoLeitura.floatData();
          if (novaMeta > 0 && novaMeta != metaTaxaAlvo) {
             metaTaxaAlvo = novaMeta;
             Serial.println(">>> COMANDO: META " + String(metaTaxaAlvo) + " L/ha <<<");
          }
       }
    }
    pulsosContados = 0;
    tempoAnterior = millis();
  }
}
