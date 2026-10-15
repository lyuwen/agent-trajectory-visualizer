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
- **Keyboard Shortcuts**: Drive the viewer without the mouse — expand/collapse, filter by the
  focused message's tool calls, split view, page jumps, and more. Press <kbd>?</kbd> in the app
  for the full cheatsheet.

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

## Keyboard Shortcuts

Press <kbd>?</kbd> anywhere in the viewer to open the cheatsheet. Shortcuts are ignored while
typing in a text field and never shadow Ctrl/Cmd/Alt chords.

| Key           | Action                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| <kbd>e</kbd>  | Expand every message                                                      |
| <kbd>f</kbd>  | Collapse every message                                                    |
| <kbd>c</kbd>  | Toggle the focused message (click a message, or use ↑/↓, to focus one)     |
| <kbd>d</kbd>  | Show only the filter chip under the mouse                                 |
| <kbd>⇧</kbd>+<kbd>d</kbd> | Show only the tool calls of the focused message              |
| <kbd>a</kbd>  | Show every type again (same as **All**)                                   |
| <kbd>s</kbd>  | Toggle the split panel                                                    |
| <kbd>o</kbd>  | Open a trajectory — the split's while split view is on, the main one otherwise |
| <kbd>w</kbd>  | Toggle scroll lock (split view only)                                      |
| <kbd>g</kbd> <kbd>g</kbd> | Go to the top of the focused panel                             |
| <kbd>⇧</kbd>+<kbd>G</kbd> | Go to the bottom of the focused panel                          |
| <kbd>?</kbd>  | Show or hide the cheatsheet (<kbd>Esc</kbd> also closes it)               |

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
