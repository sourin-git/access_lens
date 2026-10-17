# AccessLens ♿🔍

> **Spatial Web Accessibility Inspector & 3D Audit Studio**

AccessLens is a developer and accessibility specialist tool that bridges modern 3D spatial visualization with WCAG 2.1 accessibility auditing. It allows teams to inspect DOM structures in an interactive 3D canvas, simulate diverse sensory and motor profiles in real time, run automated audits, and inspect actionable code remediation recommendations.

---

## 🌟 Key Features

- **Spatial 3D Viewport**: Interactive Three.js scene mapping web elements (headings, buttons, inputs, landmarks, images) into a tactile 3D spatial layout.
- **Dynamic Profile Simulation**:
  - **Default**: Standard browsing experience.
  - **Colour Blind**: Deuteranopia color deficiency matrix filtering across canvas and live webpage.
  - **Low Vision**: High-contrast mode and 200% font scaling to simulate low-vision browser zoom.
  - **Motor Impaired**: High-visibility focus indicators and keyboard-navigable control surfaces.
  - **Cognitive**: Streamlined layout, relaxed spacing, and reduced visual distractions.
- **Automated WCAG Auditing**: Multi-phase scan engine checking contrast ratios, missing alternative text, missing form labels, skipped heading hierarchies, bypass links, and landmark roles.
- **Bi-directional 3D-to-Issue Linking**: Click any 3D element in the viewport to highlight and inspect its corresponding accessibility issue, or select an issue card to animate the camera and highlight the element in 3D.
- **Comprehensive Issue Inspector**: Detailed breakdown containing WCAG success criteria, problem diagnosis, affected user groups, actionable recommendations, and drop-in code fix snippets.
- **Audit Report & Export**: Full-screen modal report with an SVG compliance score gauge, pass/fail metrics, severity distribution, and structured JSON report export.
- **Accessibility & Motion First**: Built-in `Skip to main content` landmark, keyboard navigation (Arrow Up/Down, Enter, Space, Escape, Tab), and complete support for `prefers-reduced-motion` with an in-app toggle.

---

## 🛠️ Tech Stack

- **Runtime & Bundler**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **3D Graphics**: [Three.js](https://threejs.org/)
- **Styling**: Vanilla CSS Design System with CSS Custom Properties and zero UI framework dependencies

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation

```bash
# Clone the repository
git clone https://github.com/sourin-git/access_lens.git

# Navigate into the project directory
cd access_lens

# Install dependencies
npm install
```

### Development

```bash
# Start the local development server
npm run dev
```

The application will be live at `http://localhost:5173/`.

### Production Build

```bash
# Type check and build optimized bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Architecture Overview

```text
src/
├── main.ts            # Entry point & skip-to-content accessibility link
├── app.ts             # Orchestrator & module integration owner
├── state.ts           # Authoritative reactive AppState store (pub/sub)
├── scene.ts           # Part 1: Three.js 3D spatial scene & element meshes
├── scanner.ts         # Part 2: WCAG accessibility audit engine & profiles
├── ui/
│   ├── header.ts      # Top navigation, profile picker, motion switch & scan progress
│   ├── toolbar.ts     # Viewport controls, issue count & report launcher
│   ├── issuePanel.ts  # Severity-filtered issue list & code remediation panel
│   └── reportPanel.ts # Modal audit report, score gauge & JSON exporter
└── styles/
    ├── tokens.css     # Design tokens (colors, typography, spacing, motion)
    ├── layout.css     # Responsive workspace shell and viewport layout
    └── components.css # Interactive components, cards, chips, and modals
```

---

## 📜 License

MIT
