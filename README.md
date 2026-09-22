# ⚡ EnerNexus

### AI-Enabled Renewable Energy Management for Industrial Loads

> **SIH 26217 — Student Innovation**
>
> An IoT + AI-based energy management platform that continuously monitors electrical conditions, detects abnormal operating patterns, evaluates renewable/battery availability, manages load priorities, performs physical control, and verifies the resulting system state.

---

## 📑 Table of Contents

- [🚀 Project Overview](#-project-overview)
- [❓ Problem Statement](#-problem-statement)
- [💡 Proposed Solution](#-proposed-solution)
- [🏗️ System Architecture](#️-system-architecture)
- [⚡ Energy Sources & Loads](#-energy-sources--loads)
- [🔌 Hardware Functional Flow](#-hardware-functional-flow)
- [📡 Communication Architecture](#-communication-architecture)
- [☁️ Backend Architecture](#️-backend-architecture)
- [🤖 AI Anomaly Detection](#-ai-anomaly-detection)
- [🧠 Decision & Control Engine](#-decision--control-engine)
- [🔄 Closed-Loop Control](#-closed-loop-control)
- [📊 Digital Energy Dashboard](#-digital-energy-dashboard)
- [🖥️ Frontend](#️-frontend)
- [📈 Complete Data Flow](#-complete-data-flow)
- [🧮 Energy Management Logic](#-energy-management-logic)
- [🧪 Prototype Validation](#-prototype-validation)
- [🏭 Industrial Perspective](#-industrial-perspective)
- [📈 Scalability](#-scalability)

---

## 🚀 Project Overview

EnerNexus creates a digital representation of a connected energy system by combining:

- ⚡ Real-time electrical monitoring
- ☀️ Solar availability monitoring
- 🔋 Battery voltage & estimated State of Charge (SoC)
- 🤖 AI-based anomaly detection
- 🧠 Rule-based energy decision logic
- 🔌 Priority-based load control
- 📡 MQTT / Wi-Fi communication
- ☁️ Cloud/backend processing
- 📊 Real-time dashboard
- 🔄 Feedback-based verification

### 🧩 Core Concept

```
SENSE → CONNECT → ANALYZE → DECIDE → CONTROL → VERIFY
```

```
Sensing
   ↓
Communication
   ↓
Analytics
   ↓
Decision
   ↓
Actuation
   ↓
Verification
```

The system connects renewable availability, battery condition, electrical demand, anomaly intelligence, and load priority within a unified energy-management workflow.

---

## ❓ Problem Statement

Conventional energy monitoring systems often provide visibility into electrical parameters **without closing the loop** between detection, decision-making, and physical control.

EnerNexus addresses this gap by integrating sensing, communication, analytics, decision-making, actuation, and verification into a single continuous workflow.

---

## 💡 Proposed Solution

EnerNexus continuously observes the physical energy system and builds a software-side representation of its operating state.

```
┌──────────────────────────────┐
│      PHYSICAL ENERGY         │
│                               │
│ ☀ Solar   🔋 Battery          │
│ ⚡ Grid    🏭 Loads            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        SENSING LAYER         │
│                               │
│ V • I • P • f • T            │
│ Solar Availability            │
│ Battery Voltage                │
└──────────────┬───────────────┘
               │
               ▼
             ESP32
               │
               ▼
          MQTT / Wi-Fi
               │
               ▼
┌──────────────────────────────┐
│       CLOUD / BACKEND        │
│                               │
│ Node.js + MongoDB              │
│ Data Processing                │
└──────────────┬───────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   AI ANALYTICS    DASHBOARD
        │
        ▼
┌──────────────────────────────┐
│     DECISION ENGINE          │
│                               │
│ Renewable Priority             │
│ Demand Awareness               │
│ Load Priority                  │
│ Safety Constraints             │
└──────────────┬───────────────┘
               │
               ▼
        RELAY CONTROL
               │
        ┌──────┴──────┐
        ▼             ▼
   CRITICAL       NON-CRITICAL
     LOAD             LOAD
        │             │
        └──────┬──────┘
               ▼
       FEEDBACK / VERIFY
               │
               └──────► Continuous Monitoring
```

---

## 🏗️ System Architecture

### Architecture Layers

```
1. ENERGY SOURCES & LOADS
        ↓
2. SENSING
        ↓
3. EDGE / IoT
        ↓
4. CLOUD / BACKEND
        ↓
5. AI ANALYTICS
        ↓
6. DECISION & CONTROL
        ↓
7. ACTUATION
        ↓
8. FEEDBACK VERIFICATION
```

---

## ⚡ Energy Sources & Loads

### ☀️ Solar PV

The prototype monitors solar-side voltage to determine renewable availability.

```
Solar Voltage
      ↓
Availability Indicator
      ↓
Energy Management Decision
```

> ℹ️ The prototype does **not** claim direct solar-power measurement unless dedicated PV current/power sensing is implemented.

### 🔋 Battery Storage

Battery condition is represented using battery voltage and an estimated state of charge.

```
Battery Voltage
      ↓
Estimated SoC
      ↓
Battery Availability
      ↓
Decision Engine
```

> ℹ️ The current prototype uses **voltage-based SoC estimation** rather than coulomb-counting-based SoC.

### ⚡ Grid Supply

Grid-side electrical parameters are monitored using the **PZEM** energy measurement module:

- Voltage
- Current
- Power
- Frequency

### 🏭 Industrial Loads

Loads are separated according to operational priority.

**🔴 Critical Load**
```
Critical Load
     ↓
Priority Protected
     ↓
Normally Maintained ON
```

**🟡 Non-Critical Load**
```
Non-Critical Load
        ↓
Selective Control
        ↓
ON / OFF according to
energy-management decision
```

---

## 🔌 Hardware Functional Flow

**Renewable / Storage Path**
```
☀ SOLAR PV
     │
     ▼
CHARGING MODULE
     │
     ▼
🔋 18650 × 2
     │
     ▼
BUCK CONVERTER
     │
     ▼
ESP32
```

**Grid Sensing Path**
```
⚡ GRID
     │
     ▼
PZEM / CT SENSING
     │
     ▼
ESP32
     │
     ▼
MQTT / Wi-Fi
     │
     ▼
CLOUD
```

**Load Control Path**
```
ESP32
  │
  ▼
RELAY
  │
  ├──────────► 🔴 CRITICAL LOAD
  │
  └──────────► 🟡 NON-CRITICAL LOAD
```

---

## 📡 Communication Architecture

EnerNexus uses **Wi-Fi** and **MQTT** for bidirectional IoT communication.

```
ESP32
  │
  │ Wi-Fi
  ▼
MQTT
  │
  ├── Sensor Data
  ├── System Status
  ├── Anomaly Information
  └── Control Commands
  │
  ▼
Backend
```

**Data Direction**

```
ESP32 ─────────────► CLOUD
       Sensor Data

ESP32 ◄───────────── CLOUD
       Control Commands
```

---

## ☁️ Backend Architecture

The backend acts as the central processing and coordination layer.

```
                Node.js
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
       API       MQTT      Decision
      Layer      Layer       Logic
        │          │          │
        └──────────┼──────────┘
                   ▼
                MongoDB
                   │
                   ▼
           Historical Data
```

### 🛠️ Backend Responsibilities

- Receive sensor data
- Process measurements
- Store system information
- Provide APIs
- Interface with MQTT
- Execute decision logic
- Process anomaly information
- Send control commands
- Support dashboard visualization

---

## 🤖 AI Anomaly Detection

EnerNexus integrates **Isolation Forest** for data-driven anomaly detection.

### 🧬 AI Pipeline

```
Sensor Data
     ↓
Data Preprocessing
     ↓
Feature Extraction
     ↓
Isolation Forest
     ↓
Anomaly Detection
     ↓
Anomaly Risk Score
     ↓
Decision Engine
```

### 📥 AI Parameters

| Symbol | Parameter |
|--------|-----------|
| V | Voltage |
| I | Current |
| P | Power |
| T | Temperature |

### 📤 AI Output

```
Normal Operating Pattern
          OR
Potential Anomaly
          ↓
Anomaly Risk Score
```

The AI layer identifies unusual operating patterns and supplies anomaly information to the decision layer.

---

## 🧠 Decision & Control Engine

AI detection and control logic remain **separate layers**.

```
AI ANALYTICS
     │
     ▼
Anomaly Information
     │
     ▼
DECISION ENGINE
     │
     ├── Renewable Availability
     ├── Battery Condition
     ├── Grid Condition
     ├── Current Demand
     ├── Load Priority
     └── Safety Constraints
             │
             ▼
       Control Decision
             │
             ▼
        Relay Command
```

### 🎯 Decision Priorities

1. 🛡️ Safety
2. 🔴 Critical Load Continuity
3. ☀️ Renewable Availability
4. 🔋 Battery Condition
5. 📉 Demand Management

---

## 🔄 Closed-Loop Control

A control action is **not considered complete** until the resulting physical state is verified.

```
MEASURE
   ↓
ANALYZE
   ↓
DETECT
   ↓
DECIDE
   ↓
CONTROL
   ↓
RE-MEASURE
   ↓
VERIFY
   ↓
UPDATE DIGITAL STATE
   ↓
CONTINUE MONITORING
```

### 📝 Example Control Cycle

```
High Demand
     ↓
System State Evaluation
     ↓
Critical Load Protected
     ↓
Non-Critical Load Selected
     ↓
Relay Command
     ↓
Load State Changes
     ↓
Electrical Parameters Re-measured
     ↓
Action Verified
```

---

## 📊 Digital Energy Dashboard

The dashboard provides centralized monitoring and control.

### 🔢 Main Energy Values

- Grid Voltage
- Grid Current
- Grid Power
- Grid Frequency
- Battery Voltage
- Estimated Battery SoC
- Solar Voltage
- Solar Availability
- Temperature

### 🔌 Load Status

```
🔴 Critical Load
   ON

🟡 Non-Critical Load
   ON / OFF
```

### 📉 Energy Visualization

- Grid power trend
- Voltage trend
- Current trend
- Solar voltage trend
- Battery voltage trend
- Temperature trend

### 🟢 AI Status

```
SYSTEM STATUS

🟢 Normal
      OR
🔴 Anomaly Detected
```

### 🎛️ Control

- Critical load status
- Non-critical load status
- Relay state
- Control command status

---

## 🖥️ Frontend

The dashboard is designed using a modern web architecture.

```
React
 │
 ├── Real-Time Monitoring
 ├── Energy Cards
 ├── Graphs
 ├── Load Status
 ├── Relay Control
 ├── AI Status
 └── System Visualization
```

> 🌐 **Three.js** can be used for advanced digital-energy visualization and digital-twin representation.

---

## 📈 Complete Data Flow

```
                 PHYSICAL SYSTEM
                        │
                        ▼
                   SENSORS
                        │
                        ▼
                     ESP32
                        │
                        ▼
                   Wi-Fi/MQTT
                        │
                        ▼
                Node.js Backend
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
          MongoDB              AI ENGINE
                                   │
                            Isolation Forest
                                   │
             └──────────┬──────────┘
                        ▼
                 Decision Engine
                        │
                        ▼
                  Control Command
                        │
                        ▼
                      ESP32
                        │
                        ▼
                      Relay
                        │
                 ┌──────┴──────┐
                 ▼             ▼
          Critical Load   Non-Critical Load
                 │             │
                 └──────┬──────┘
                        ▼
                 Feedback Sensors
                        │
                        ▼
                    MQTT/Cloud
                        │
                        ▼
                    Dashboard
```

---

## 🧮 Energy Management Logic

EnerNexus evaluates multiple system conditions before generating a control decision.

```
Grid Condition
      +
Solar Availability
      +
Battery Condition
      +
Demand
      +
Load Priority
      +
Safety Constraints
      ↓
ENERGY MANAGEMENT DECISION
```

### ⚙️ Simplified Decision Logic

```
IF system condition is normal
    → Maintain operation

IF renewable availability is sufficient
    → Prioritize renewable availability

IF battery availability is adequate
    → Consider stored energy

IF demand becomes excessive
    → Protect critical load
    → Evaluate non-critical load

IF anomaly is detected
    → Generate anomaly risk
    → Evaluate control response

AFTER CONTROL
    → Re-measure
    → Verify
    → Update system state
```

---

## 🧪 Prototype Validation

| Area | Validation |
|------|------------|
| ⚡ Grid Monitoring | Voltage, Current, Power, Frequency |
| ☀️ Solar Monitoring | Solar Voltage / Availability |
| 🔋 Battery Monitoring | Battery Voltage / Estimated SoC |
| 🔌 Load Control | Relay ON/OFF |
| 🔴 Critical Load | Priority maintained |
| 🟡 Non-Critical Load | Selective control |
| 📡 Communication | MQTT |
| ☁️ Backend | Data processing & storage |
| 🤖 AI | Anomaly detection |
| 📊 Dashboard | Real-time visualization |
| 🎛️ Control | Command → Actuation |
| 🔄 Feedback | Post-action verification |

---

## 🏭 Industrial Perspective

EnerNexus is structured around concepts applicable to connected energy-management environments.

### 🎯 Target Environments

- 🏭 Industrial facilities
- 🏢 Commercial buildings
- 🎓 Educational campuses
- 🏥 Critical infrastructure
- ⚡ Microgrids
- 🏘️ Smart buildings
- 🏬 Distributed energy systems

### 🔁 Industrial Workflow

```
Energy Monitoring
       ↓
Condition Awareness
       ↓
Anomaly Detection
       ↓
Decision Support
       ↓
Priority-Based Control
       ↓
Verification
       ↓
Historical Analysis
```

---

## 📈 Scalability

The architecture can expand from a single prototype node to multiple distributed energy nodes.

```
                    CLOUD
                      │
          ┌───────────┼───────────┐
          │           │           │
        NODE 1      NODE 2      NODE 3
          │           │           │
        LOADS       LOADS       LOADS
```

### 🛤️ Expansion Path

```
Single Node
     ↓
Multiple Nodes
     ↓
Multiple Load Zones
     ↓
Facility-Level EMS
     ↓
Multi-Site Deployment
```

---

<p align="center"><b>⚡ EnerNexus — Closing the loop between sensing and action. ⚡</b></p>
