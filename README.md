
---

## 🛡️ Vigil: Browser-Based AI Threat Detection System (MVP)

**Vigil** is a browser-based AI threat detection app using **React 19**, **TypeScript**, **TailwindCSS**, **WebRTC**, **Web Speech API**, the **Google Gemini API**, and **TensorFlow.js**. It analyzes live webcam/mic feeds to detect aggression, weapons, bullying, and specific non-verbal sounds, with real-time annotations, event logging, session tools, and full client-side privacy.

> ⚠️ **Note:** This is an MVP (Minimum Viable Product) designed to demonstrate the core capabilities of Vigil. It is not a production-ready release and may lack features, scalability, or optimizations planned for future versions.

---

## 🚀 Overview

Vigil transforms any webcam into an intelligent, real-time security system. By combining modern browser APIs with powerful multimodal AI, it identifies:

* **Physical aggression** (e.g., punching, pushing, hostile stances)
* **High-risk objects** (e.g., knives, tools) with risk scores and explanations
* **Verbal threats** (e.g., bullying, harassment, toxicity)
* **Non-verbal sounds** (e.g., gunshots, explosions, screaming)

It overlays visual alerts on the live feed, logs events as they occur, and supports professional review workflows—all without sending raw data off-device.

---

## 🔧 Tech Stack

| Category         | Technology                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| **Frontend**     | `React 19`, `TypeScript`, `TailwindCSS`, `Vite`                         |
| **AI Models**    | `Google Gemini API (gemini-1.5-pro-latest)` for image & language understanding |
|                  | `TensorFlow.js` with `YAMNet` for sound classification                  |
| **Browser APIs** | `WebRTC (getUserMedia)`, `Web Speech API`, `Web Audio API`              |

---

## ✨ Key Features

| Feature                                | Description                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 🧠 **Real-Time Multi-Threat Analysis** | Detects aggression, objects, verbal abuse, and specific sounds using multimodal AI. |
| 🎯 **Live Visual Annotations**         | Bounding boxes overlaid in real time: Red (aggression), Yellow (objects), Blue (person tracking).            |
| 🔊 **Non-Verbal Sound Detection**    | Identifies sounds like gunshots, explosions, and screaming using a client-side audio model. |
| 🔔 **Instant Event Logging**           | AI-generated incident logs with timestamps, classifications, and justifications.                             |
| 📇 **Session Review Tools**            | Archive/review incidents, export summaries for escalation or documentation.                                  |
| 🔒 **Privacy-First**                   | Raw streams never leave the browser. All inference happens locally or through selective frame/text sampling. |

---

## 🛠️ How It Works

1. **Start Monitoring**: User clicks a button and grants camera/mic access via browser permissions.
2. **Asynchronous Analysis Loops**:

   * 📸 **Image Loop (\~1.5s):** Captures a frame, sends to Gemini for threat and object analysis.
   * 🗣️ **Verbal Loop (\~5s):** Transcribes audio via Web Speech API, sends text to Gemini for verbal threat detection.
   * 🔊 **Audio Event Loop (real-time):** Analyzes the raw microphone stream with YAMNet to detect specific sound events (e.g., gunshots).
3. **Feedback & Logging**: Structured Gemini responses update the UI and populate the event log.

---

## 🔐 Privacy Architecture

* 100% **client-side processing**; no backend server needed
* **WebRTC** and **Web Speech API** for safe, permission-based access
* Gemini API receives only minimal, non-identifying inputs
* Optimized for **offline-ready**, **edge-level deployments**

---

## 🧪 Known MVP Limitations

* Not optimized for low latency or high-frame-rate scenarios
* No backend or database integration (yet)
* No alert delivery (e.g., email, Slack)
* Gemini prompt tuning is ongoing for threat specificity
* Not tested in real-world school or office deployments
* No mobile layout or accessibility optimizations

---

## 📦 Use Cases (Planned)

* **K–12 Schools**: Detect fights, bullying, weapon exposure, or sounds like gunshots.
* **Workplaces**: Monitor hostile behavior in sensitive zones
* **Retail/Public**: Lightweight safety monitoring in cash handling or entry zones

---

## 🔮 Future Roadmap

* Multi-camera dashboard
* Alert integrations (Slack, Email, SMS)
* Admin roles & user authentication
* On-device fallback using ONNX/WebAssembly
* Full audit dashboard with risk trends

---


