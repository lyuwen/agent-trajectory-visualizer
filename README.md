# Agent Trajectory Visualizer

A modern, offline-first React application to visualize agentic trajectories from JSON logs.

## Features

- **Drag & Drop Loading**: Easily load trajectory JSON files.
- **Modern UI**: Dark mode, glassmorphism, and clean typography (`Inter` + `JetBrains Mono`).
- **Rich Message Visualization**:
  - Distinguishes **System** (yellow, folded by default), **User** (blue), and **Assistant** (purple) messages.
  - Renders Markdown content with syntax highlighting.
  - Collapsible messages.
- **Coherent Tool Execution**:
  - Displays tool calls with their arguments and outputs grouped together.
  - Collapsible tool details.
- **Git Patch Viewer**:
  - Shows the final result git patch in a dedicated, syntax-highlighted folded panel.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Navigate to the URL shown in terminal (usually `http://localhost:5173`).

4.  **Visualize**:
    Drag and drop your `*.history.json` file onto the upload area.

## Technologies

- **Vite** + **React**
- **React Dropzone**
- **React Markdown** + **Prism Syntax Highlighter**
- **Lucide React** (Icons)
- **CSS Modules / Variables** for styling

## Docker Deployment

1.  **Build the Image**:
    ```bash
    docker build -t agent-visualizer .
    ```

2.  **Run the Container**:
    ```bash
    docker run -p 8080:80 agent-visualizer
    ```

3.  **Access**:
    Open `http://localhost:8080` in your browser.
