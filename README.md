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
- **Tools Count Display**:
  - Shows the number of tools available in the trajectory at the top of the viewer.
  - Hover over the tools count to see a tooltip with tool names and descriptions.
  - Automatically extracts tool information from the `tools` field in your trajectory JSON.

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

## Trajectory JSON Format

Your trajectory JSON file should follow this structure:

```json
{
  "instance_id": "example-123",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "bash",
        "description": "Execute bash commands in the terminal"
      }
    },
    {
      "type": "function",
      "function": {
        "name": "str_replace_editor",
        "description": "Edit files using string replacement"
      }
    }
  ],
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant..."
    },
    {
      "role": "user",
      "content": "Please help me with..."
    }
  ]
}
```

**Key Fields:**
- `instance_id` (optional): Identifier for the trajectory, displayed in the header.
- `tools` (optional): Array of tool definitions. Each tool should have a `type` and `function` object with `name` and `description`.
- `messages` (required): Array of conversation messages with `role` and `content`.

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
