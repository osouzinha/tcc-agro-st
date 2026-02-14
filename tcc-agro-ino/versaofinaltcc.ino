#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <FirebaseESP32.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <LittleFS.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// --- 1. IDENTIDADE DO TRATOR (MUDE AQUI) ---
#define ID_TRATOR "Trator_01" 

// --- 2. CONFIGURAÇÕES ---
#define API_KEY "AIzaSyCtLg3GKT4ROaF6u5YO9UZDuHwBmPUPXRI"
#define DATABASE_URL "tcc-agro-st-default-rtdb.firebaseio.com"

#define GPS_TX_PIN 27 
#define GPS_RX_PIN 26 
#define PIN_SENSOR_FLUXO 14 
#define LED_STATUS 2 

float larguraFaixa = 0.5;     
float fatorCalibracao = 98.0; 

TinyGPSPlus gps;
HardwareSerial SerialGPS(1);
WebServer server(80);
Preferences preferences; 
FirebaseData fbdo;
FirebaseData fbdoLeitura; // Objeto extra só para ler dados sem travar o envio
FirebaseAuth auth;
FirebaseConfig config;

volatile long pulsosContados = 0;
float vazaoLPM = 0.0, velocidadeKPH = 0.0, taxaAplicacao = 0.0;
unsigned long tempoAnterior = 0;
String ssid_alvo = "", pass_alvo = "";
bool firebaseOnline = false;
unsigned long botaoPressionadoTempo = 0;
bool limpando = false;

// Variável para guardar a meta recebida do site
float metaTaxaAlvo = 0.0; 

void IRAM_ATTR contarPulsos() { pulsosContados++; }

// --- GRAVAÇÃO CSV ---
void gravarInterno() {
  File file = LittleFS.open("/historico.csv", "a"); 
  if (!file) return;
  String linha = String(millis()/1000) + ";" + String(vazaoLPM, 1) + ";" + String(velocidadeKPH, 1) + ";" + String(taxaAplicacao, 1) + ";";
  if (gps.location.isValid()) linha += String(gps.location.lat(), 6) + ";" + String(gps.location.lng(), 6);
  else linha += "0;0";
  file.println(linha);
  file.close();
}

// --- ESCANEAMENTO WI-FI ---
String obterListaRedes() {
  int n = WiFi.scanNetworks();
  String opcoes = "<option value=''>-- Selecione sua Rede --</option>";
  for (int i = 0; i < n; ++i) opcoes += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + "</option>";
  return opcoes;
}

// --- PÁGINA WEB (192.168.4.1) ---
void handleRoot() {
  server.send(200, "text/html", "<h1>Painel " + String(ID_TRATOR) + "</h1><p>Acesse /config para Wi-Fi ou baixe o CSV.</p>");
}
// (Mantive simplificado aqui para focar na lógica IoT, mas pode manter o HTML completo da versão anterior se quiser)

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
  server.begin();
  Serial.println("--- SISTEMA INICIADO: " + String(ID_TRATOR) + " ---");
}

void loop() {
  server.handleClient();
  
  // RESET FÍSICO
  if (digitalRead(0) == LOW) {
    if (botaoPressionadoTempo == 0) botaoPressionadoTempo = millis();
    if (millis() - botaoPressionadoTempo > 5000 && !limpando) {
      limpando = true;
      preferences.begin("wifi_config", false); preferences.clear(); preferences.end();
      WiFi.disconnect(true, true);
      ESP.restart();
    }
  } else { botaoPressionadoTempo = 0; }

  // CONEXÃO FIREBASE
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

  // --- LOOP PRINCIPAL (1 SEGUNDO) ---
  if (millis() - tempoAnterior > 1000) {
    vazaoLPM = (float)pulsosContados / fatorCalibracao;
    if (gps.location.isValid()) velocidadeKPH = gps.speed.kmph(); else velocidadeKPH = 0.0;
    
    // Simulação para testes (se tiver fluxo mas estiver parado)
    // if (vazaoLPM > 0.1 && velocidadeKPH < 1.0) velocidadeKPH = 5.0;

    if (velocidadeKPH > 0.5) taxaAplicacao = (vazaoLPM * 600.0) / (velocidadeKPH * larguraFaixa);
    else taxaAplicacao = 0.0;
    
    gravarInterno();
    
    // LOG
    Serial.print("["); Serial.print(ID_TRATOR); Serial.print("] ");
    Serial.print("Vazao: "); Serial.print(vazaoLPM);
    Serial.print(" | Meta Atual: "); Serial.println(metaTaxaAlvo);

    // ENVIO E RECEBIMENTO FIREBASE
    if (firebaseOnline && Firebase.ready()) {
       String caminho = "/frota/" + String(ID_TRATOR);

       // 1. ENVIA DADOS
       Firebase.setFloat(fbdo, caminho + "/vazao", vazaoLPM);
       Firebase.setFloat(fbdo, caminho + "/velocidade", velocidadeKPH);
       Firebase.setFloat(fbdo, caminho + "/taxa", taxaAplicacao);
       
       // *** CORAÇÃO DO SISTEMA (HEARTBEAT) ***
       // Envia o tempo atual para o site saber que estamos online
       Firebase.setInt(fbdo, caminho + "/ts", millis()); 

       if (gps.location.isValid()) {
          Firebase.setFloat(fbdo, caminho + "/lat", gps.location.lat());
          Firebase.setFloat(fbdo, caminho + "/lon", gps.location.lng());
       }

       // 2. LÊ COMANDOS DO SITE (Telemetria Reversa)
       // Verifica se existe uma nova meta na nuvem
       if (Firebase.getFloat(fbdoLeitura, caminho + "/comando/meta_taxa")) {
          float novaMeta = fbdoLeitura.floatData();
          if (novaMeta > 0 && novaMeta != metaTaxaAlvo) {
             metaTaxaAlvo = novaMeta;
             Serial.println(">>> NOVO COMANDO RECEBIDO: META " + String(metaTaxaAlvo) + " L/ha <<<");
             // Aqui você colocaria o código para controlar o motor/servo da válvula
          }
       }
    }
    pulsosContados = 0;
    tempoAnterior = millis();
  }
}