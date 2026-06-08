# SISTEMA DE MONITORAMENTO DA TAXA DE APLICAÇÃO EM PULVERIZADORES AGRÍCOLAS BASEADO EM MICROCONTROLADOR

**Autor:** Arthur Souza Porfírio  
**Orientador:** Prof. Dr. Valter Blauth Júnior  
**Instituição:** Universidade do Extremo Sul Catarinense (UNESC)  

**Acesso à Aplicação em Produção:** [https://agro.stdigital.com.br/](https://agro.stdigital.com.br/)

---

## SOBRE O PROJETO
Este repositório contém o código-fonte (firmware e aplicação web) desenvolvido para o Trabalho de Conclusão de Curso (TCC). O projeto consiste em um sistema de telemetria baseado em Internet das Coisas (IoT) para monitorar, quase em tempo real, a taxa de aplicação de insumos em pulverizadores agrícolas. 

O sistema utiliza processamento em borda para cruzar dados de vazão e velocidade, mitigando erros mecânicos (como vibrações e variações de pressão) através de um método de calibração dinâmica via software.

---

## ARQUITETURA DE HARDWARE
- **Microcontrolador:** ESP32 (responsável pelo processamento em borda e Wi-Fi)
- **Módulo de Geolocalização:** GPS NEO-6M
- **Sensor de Fluxo:** Sensor em polímero (efeito Hall)

---

## ESTRUTURA DO REPOSITÓRIO
- `/firmware` -> Código-fonte em C/C++ para o ESP32 (`tcctratorv2.ino`). Contém as rotinas de interrupção (RAM), leitura do GPS, cálculo dinâmico da taxa de aplicação e o servidor web embarcado (Access Point).
- `/tcc-agro-web` -> Código da interface gerencial (Dashboard). Responsável pela recepção dos pacotes JSON e plotagem dos mapas de calor.

---

## PRINCIPAIS FUNCIONALIDADES (ALGORITMOS)
1. **Calibração Dinâmica de Campo:** Algoritmo de compensação empírica ajustado no firmware para reduzir o erro relativo de leitura para ±4,66%.
2. **Funcionamento Offline:** O ESP32 atua como Access Point (AP), permitindo o roteamento de dados em áreas rurais sem cobertura de internet.
3. **Prevenção de Falhas:** Recálculo contínuo da taxa (L/ha) demonstrando de forma georreferenciada áreas de superdosagem (em frenagens) e subdosagem (em acelerações).

---

## COMO EXECUTAR O PROJETO

### FIRMWARE (ESP32):
1. Abra o arquivo `tcctratorv2.ino` da pasta `/firmware` na Arduino IDE ou PlatformIO.
2. Certifique-se de instalar as bibliotecas dependentes (ex: `TinyGPS++`, `WiFi`, etc.).
3. Compile e faça o upload para a placa ESP32.

### APLICAÇÃO WEB (Dashboard):
Pré-requisito: Necessário ter o [Node.js](https://nodejs.org/) instalado.

1. Acesse a pasta da interface web:
   ```bash
   cd tcc-agro-web
