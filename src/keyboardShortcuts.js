/**
 * Keyboard shortcuts the trajectory viewer answers to.
 *
 * The list below is the single source of truth for the `?` help panel, so a
 * binding has to be described here to be discoverable. `keys` holds one keycap
 * per entry; multi-key chords (like `gg`) are listed as their own keycaps.
 */
export const SHORTCUT_GROUPS = [
    {
        title: 'Messages',
        shortcuts: [
            { keys: ['e'], label: 'Expand every message' },
            { keys: ['f'], label: 'Collapse every message' },
            { keys: ['c'], label: 'Toggle the focused message' },
        ],
    },
    {
        title: 'Filters',
        shortcuts: [
            { keys: ['d'], label: 'Show only the chip under the mouse' },
            { keys: ['Shift', 'd'], label: 'Show only the focused message’s tool calls' },
            { keys: ['a'], label: 'Show every type again (All)' },
        ],
    },
    {
        title: 'Split view',
        shortcuts: [
            { keys: ['s'], label: 'Toggle the split panel' },
            { keys: ['o'], label: 'Open a trajectory in the split' },
            { keys: ['w'], label: 'Toggle scroll lock (split only)' },
        ],
    },
    {
        title: 'Page',
        shortcuts: [
            { keys: ['g', 'g'], label: 'Go to the top of the focused panel' },
            { keys: ['Shift', 'G'], label: 'Go to the bottom of the focused panel' },
        ],
    },
    {
        title: 'Help',
        shortcuts: [
            { keys: ['?'], label: 'Show or hide this panel' },
        ],
    },
];

/**
 * How long a pending `g` waits for its second `g` before the chord is dropped.
 * Long enough to type `gg` at a normal pace, short enough that a stray `g`
 * never swallows the next shortcut.
 */
export const G_CHORD_TIMEOUT_MS = 800;

const TYPING_TAGS = new Set(['TEXTAREA', 'SELECT']);

// Input types that swallow printable keys. Checkboxes, radios, file pickers and
// buttons are deliberately absent: focus can sit on one of those (say, the
// hidden file input after a replace) while the user expects shortcuts to work.
const TYPING_INPUT_TYPES = new Set([
    'text',
    'search',
    'email',
    'url',
    'tel',
    'password',
    'number',
    'date',
    'datetime-local',
    'month',
    'week',
    'time',
]);

/**
 * True when a key event is going into a text field (or a contenteditable host)
 * and must be left to the field instead of being read as a shortcut.
 * @param {EventTarget|null|undefined} target
 * @returns {boolean}
 */
export function isTypingTarget(target) {
    if (!target || typeof target !== 'object') return false;
    if (target.isContentEditable) return true;
    if (TYPING_TAGS.has(target.tagName)) return true;
    if (target.tagName !== 'INPUT') return false;
    const type = (target.getAttribute?.('type') || 'text').toLowerCase();
    return TYPING_INPUT_TYPES.has(type);
}
