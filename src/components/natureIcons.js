import { Terminal, Pencil, Eye, Brain, Flag, Users, Wrench } from 'lucide-react';

// One symbol per kind of work, shared by the tool-card icon and the
// message-level tool pills so the same glyph always means the same activity.
// The colors that go with these live in the `--nature-*` tokens in index.css.
export const NATURE_ICONS = {
    shell: Terminal,
    edit: Pencil,
    read: Eye,
    think: Brain,
    finish: Flag,
    task: Users,
    other: Wrench,
};

export const natureIcon = (nature) => NATURE_ICONS[nature] ?? Wrench;
