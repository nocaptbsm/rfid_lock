/*
 * RFID Library Access Control — ESP32 + MFRC522
 * Firmware v2.2 — Relay diagnostics
 *
 * Fixes applied:
 *   1. Explicit SPI pin assignment for ESP32 (VSPI)
 *   2. Relay pinned HIGH (off) before WiFi init to prevent glitch
 *   3. MFRC522 self-test on boot with retry
 *   4. Non-blocking WiFi with auto-reconnect
 *   5. Watchdog-safe loop structure
 *   6. Better serial diagnostics
 *
 * Wiring (ESP32 DevKit V1):
 *   MFRC522 SDA  → GPIO 5  (SS)
 *   MFRC522 SCK  → GPIO 18
 *   MFRC522 MOSI → GPIO 23
 *   MFRC522 MISO → GPIO 19
 *   MFRC522 RST  → GPIO 4
 *   MFRC522 3.3V → 3.3V
 *   MFRC522 GND  → GND
 *   Buzzer        → GPIO 26
 *   Relay IN      → GPIO 27
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Preferences.h>
#include "secrets.h"
#include "certs.h"

// ─── Pin Definitions ─────────────────────────────────────────
#define SS_PIN      5     // SDA / Chip Select
#define RST_PIN     4     // Reset (GPIO2 = built-in blue LED — do NOT use!)
#define SCK_PIN     18    // SPI Clock
#define MISO_PIN    19    // SPI MISO
#define MOSI_PIN    23    // SPI MOSI
#define BUZZER_PIN  26
#define RELAY_PIN   27

// ─── Relay Trigger Mode ──────────────────────────────────────
// Try changing this if your relay doesn't respond:
//   false = Active-LOW  (most common: LOW turns relay ON)
//   true  = Active-HIGH (some modules: HIGH turns relay ON)
#define RELAY_ACTIVE_HIGH false

#define RELAY_ON   (RELAY_ACTIVE_HIGH ? HIGH : LOW)
#define RELAY_OFF  (RELAY_ACTIVE_HIGH ? LOW  : HIGH)

// ─── Network Config ──────────────────────────────────────────
// Credentials are now in secrets.h
// const char* ssid      = WIFI_SSID;
// const char* password  = WIFI_PASS;
// const char* serverURL = SERVER_URL;
// const char* apiKey    = API_KEY;


// ─── WiFi Timeouts ──────────────────────────────────────────
#define WIFI_CONNECT_TIMEOUT_MS  15000   // 15 sec max on boot
#define WIFI_RECONNECT_INTERVAL  30000   // retry every 30 sec
unsigned long lastWiFiAttempt = 0;

// ─── User Tracking ──────────────────────────────────────────
#define MAX_USERS 50
String knownUIDs[MAX_USERS];
bool   insideLibrary[MAX_USERS];
int    userCount = 0;

// ─── Offline Allowlist ──────────────────────────────────────
Preferences prefs;
int authUserCount = 0;
String authUIDs[MAX_USERS];

void loadAllowlist() {
  prefs.begin("allowlist", true); // read-only
  authUserCount = prefs.getInt("count", 0);
  for (int i = 0; i < authUserCount; i++) {
    authUIDs[i] = prefs.getString(("uid_" + String(i)).c_str(), "");
  }
  prefs.end();
  Serial.printf("[AUTH] Loaded %d authorized UIDs from flash\n", authUserCount);
}

bool isAuthorized(const String& uid) {
  for (int i = 0; i < authUserCount; i++) {
    if (authUIDs[i] == uid) return true;
  }
  return false;
}

// ─── RFID Instance ──────────────────────────────────────────
MFRC522 rfid(SS_PIN, RST_PIN);

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

int findUID(const String& uid) {
  for (int i = 0; i < userCount; i++) {
    if (knownUIDs[i] == uid) return i;
  }
  return -1;
}

bool toggleInside(const String& uid) {
  int idx = findUID(uid);
  if (idx == -1) {
    if (userCount < MAX_USERS) {
      knownUIDs[userCount]     = uid;
      insideLibrary[userCount] = true;
      userCount++;
    }
    return true;   // first scan = entry
  }
  insideLibrary[idx] = !insideLibrary[idx];
  return insideLibrary[idx];
}

// ─── Buzzer Feedback ─────────────────────────────────────────
void beepSuccess() {
  // 2 short beeps → access granted
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(120);
    digitalWrite(BUZZER_PIN, LOW);
    delay(80);
  }
}

void beepError() {
  // 1 long beep → error / denied
  digitalWrite(BUZZER_PIN, HIGH);
  delay(600);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepBoot() {
  // Quick chirp on successful boot
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);
}

// ─── Relay Control ───────────────────────────────────────────
void unlockGate() {
  Serial.println("[RELAY] Unlocking gate...");
  digitalWrite(RELAY_PIN, RELAY_ON);
  delay(2000);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  Serial.println("[RELAY] Gate locked.");
}

// ─── Relay Self-Test (tests BOTH polarities) ─────────────────
void relaySelfTest() {
  Serial.println("\n╔══════════════════════════════════════╗");
  Serial.println("║     RELAY DIAGNOSTIC TEST            ║");
  Serial.println("╚══════════════════════════════════════╝");
  Serial.printf("[TEST] RELAY_PIN = GPIO %d\n", RELAY_PIN);
  Serial.printf("[TEST] Configured mode: %s\n",
    RELAY_ACTIVE_HIGH ? "ACTIVE-HIGH" : "ACTIVE-LOW");

  // ── Test 1: Active-LOW (most common) ──
  Serial.println("\n[TEST] === Test 1: Active-LOW (LOW=ON) ===");
  digitalWrite(RELAY_PIN, HIGH);
  delay(300);
  Serial.println("[TEST]   → Setting LOW (should turn ON)...");
  digitalWrite(RELAY_PIN, LOW);
  delay(1000);   // LISTEN for click
  Serial.println("[TEST]   → Setting HIGH (should turn OFF)...");
  digitalWrite(RELAY_PIN, HIGH);
  delay(500);

  // ── Test 2: Active-HIGH ──
  Serial.println("\n[TEST] === Test 2: Active-HIGH (HIGH=ON) ===");
  digitalWrite(RELAY_PIN, LOW);
  delay(300);
  Serial.println("[TEST]   → Setting HIGH (should turn ON)...");
  digitalWrite(RELAY_PIN, HIGH);
  delay(1000);   // LISTEN for click
  Serial.println("[TEST]   → Setting LOW (should turn OFF)...");
  digitalWrite(RELAY_PIN, LOW);
  delay(500);

  // Leave in OFF state
  digitalWrite(RELAY_PIN, RELAY_OFF);

  Serial.println("\n[TEST] ════════════════════════════════════");
  Serial.println("[TEST] RESULTS:");
  Serial.println("[TEST]   Did relay click during Test 1? → Active-LOW (default)");
  Serial.println("[TEST]   Did relay click during Test 2? → Change RELAY_ACTIVE_HIGH to true");
  Serial.println("[TEST]   No click at all? → 3.3V LOGIC LEVEL PROBLEM");
  Serial.println("[TEST]");
  Serial.println("[TEST] ★ FIX: Move relay VCC from 5V to 3.3V pin");
  Serial.println("[TEST]   Most relay modules with optocouplers will");
  Serial.println("[TEST]   respond to 3.3V signal ONLY if VCC is also 3.3V.");
  Serial.println("[TEST]   This is the #1 fix for ESP32 + relay.");
  Serial.println("[TEST]");
  Serial.println("[TEST]   OR: Wire a 2N2222 NPN transistor as level shifter.");
  Serial.println("[TEST] ════════════════════════════════════");
  Serial.println("[TEST] Type 'r' in Serial Monitor to manually toggle relay.\n");
}

// ─── WiFi (non-blocking) ────────────────────────────────────
bool connectWiFi(unsigned long timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.printf("[WIFI] Connecting to \"%s\"...\n", WIFI_SSID);
  WiFi.disconnect(true);   // clean slate
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > timeoutMs) {
      Serial.println("\n[WIFI] Connection TIMEOUT — continuing offline.");
      return false;
    }
    delay(250);
    Serial.print(".");
  }
  Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  return true;
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWiFiAttempt < WIFI_RECONNECT_INTERVAL) return;

  lastWiFiAttempt = millis();
  Serial.println("[WIFI] Lost connection — attempting reconnect...");
  connectWiFi(5000);   // quick 5-sec retry in loop
}

// ─── RFID Reader Init with Retry ─────────────────────────────
bool initRFID() {
  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.printf("[RFID] Init attempt %d/3...\n", attempt);

    rfid.PCD_Init();
    delay(100);   // let the reader stabilise

    byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("[RFID] Firmware version: 0x%02X\n", version);

    // Valid MFRC522 versions: 0x91 (v1.0), 0x92 (v2.0), 0x88 (clone)
    if (version == 0x91 || version == 0x92 || version == 0x88) {
      rfid.PCD_DumpVersionToSerial();
      Serial.println("[RFID] Reader online ✓");
      return true;
    }

    if (version == 0x00 || version == 0xFF) {
      Serial.println("[RFID] ⚠ No response — check wiring!");
    } else {
      Serial.printf("[RFID] ⚠ Unexpected version 0x%02X\n", version);
    }

    delay(500);
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// Setup
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);   // let serial stabilise
  Serial.println("\n============================");
  Serial.println("  RFID Lock v2.0 — Booting");
  Serial.println("============================");

  // ── 1. Pin init FIRST (before anything else) ──
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);   // Relay OFF immediately
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);   // Buzzer OFF

  Serial.println("[BOOT] Relay & Buzzer pins set.");

  // ── 1b. Relay self-test (toggle 2x so user can verify) ──
  relaySelfTest();

  // ── 1c. Load offline allowlist ──
  loadAllowlist();

  // ── 2. SPI + RFID ──
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);   // Explicit ESP32 VSPI pins
  Serial.println("[BOOT] SPI bus initialised.");

  bool rfidOK = initRFID();
  if (!rfidOK) {
    Serial.println("[BOOT] ✘ RFID reader FAILED — check wiring:");
    Serial.println("         SDA→GPIO5  SCK→GPIO18  MOSI→GPIO23");
    Serial.println("         MISO→GPIO19  RST→GPIO4  3.3V+GND");
    // Long error beep
    beepError();
    // Continue anyway so serial monitor keeps reporting
  } else {
    beepBoot();
  }

  // ── 3. WiFi (with timeout — won't hang forever) ──
  connectWiFi(WIFI_CONNECT_TIMEOUT_MS);

  // ── 4. Time sync ──
  if (WiFi.status() == WL_CONNECTED) {
    configTime(19800, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("[BOOT] NTP time sync requested.");
  }

  Serial.println("[BOOT] Setup complete — scanning for cards...\n");
}

// ═══════════════════════════════════════════════════════════════
// Main Loop
// ═══════════════════════════════════════════════════════════════
void loop() {
  // ── Serial command: type 'r' to manually toggle relay ──
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'r' || cmd == 'R') {
      Serial.println("\n[MANUAL] Toggling relay...");
      digitalWrite(RELAY_PIN, RELAY_ON);
      Serial.println("[MANUAL] Relay ON — check if it clicked");
      delay(2000);
      digitalWrite(RELAY_PIN, RELAY_OFF);
      Serial.println("[MANUAL] Relay OFF");
    }
    if (cmd == 't' || cmd == 'T') {
      // Raw GPIO test — bypass relay macros
      Serial.println("\n[RAW] GPIO 27 raw toggle test:");
      Serial.println("[RAW] HIGH...");
      digitalWrite(RELAY_PIN, HIGH);
      delay(1500);
      Serial.println("[RAW] LOW...");
      digitalWrite(RELAY_PIN, LOW);
      delay(1500);
      Serial.println("[RAW] HIGH...");
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("[RAW] Done. Did anything change?");
    }
  }

  // Keep WiFi alive (non-blocking)
  ensureWiFi();

  // ── Check for new RFID card ──
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  // ── Build UID string ──
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  Serial.println("─────────────────────────");
  Serial.println("[SCAN] Card UID: " + uid);

  // ── Handle Offline vs Online ──
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Offline — checking local allowlist.");
    if (isAuthorized(uid)) {
      Serial.println("[AUTH] UID locally authorized.");
      beepSuccess();
      unlockGate();
    } else {
      Serial.println("[AUTH] ✘ UID not in allowlist. Access denied offline.");
      beepError();
    }
  } else {
    // ── Toggle entry/exit ──
    bool nowInside   = toggleInside(uid);
    String eventType = nowInside ? "entry" : "exit";
    Serial.println("[SCAN] Event: " + eventType);

    // ── Build JSON payload ──
    time_t now;
    time(&now);

    StaticJsonDocument<256> doc;
    doc["uid"]       = uid;
    doc["event"]     = eventType;
    doc["timestamp"] = (long)now;
    doc["device_id"] = DEVICE_ID;

    String payload;
    serializeJson(doc, payload);
    Serial.println("[SCAN] Payload: " + payload);

    // ── Send to server ──
    WiFiClientSecure client;
    client.setCACert(render_root_ca); // TLS cert pinning

    HTTPClient http;
    http.begin(client, SERVER_URL);
    http.setTimeout(10000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_KEY);

    int httpCode = http.POST(payload);
    String body  = http.getString();
    http.end();

    Serial.printf("[HTTP] Response: %d\n", httpCode);
    Serial.println("[HTTP] Body: " + body);

    if (httpCode == 200) {
      beepSuccess();
      unlockGate();
    } else {
      Serial.println("[HTTP] ✘ Server rejected — access denied.");
      toggleInside(uid); // Revert the toggle since entry was denied
      beepError();
    }
  }

  // ── Halt card so it's not read again immediately ──
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1500);   // debounce — prevent double-reads
}
