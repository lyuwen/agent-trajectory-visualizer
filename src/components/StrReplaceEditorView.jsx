import './StrReplaceEditorView.css';

const MINUS = '\u2212';

const hasLineNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const formatLineNumber = (value) => (hasLineNumber(value) ? String(value) : '');

const toRows = (rows) =>
  Array.isArray(rows) ? rows.filter((row) => row !== null && typeof row === 'object') : [];

const previewRowGutters = (row) => ({
  oldLine: formatLineNumber(row.oldLine),
  newLine: formatLineNumber(row.newLine),
});

const diffRowMeta = (row) => {
  switch (row.type) {
    case 'add':
      return {
        className: 'str-editor-row is-add',
        label: hasLineNumber(row.newLine) ? `added line ${row.newLine}` : 'added line',
        marker: '+',
        oldLine: '',
        newLine: formatLineNumber(row.newLine),
      };
    case 'remove':
      return {
        className: 'str-editor-row is-remove',
        label: hasLineNumber(row.oldLine) ? `removed line ${row.oldLine}` : 'removed line',
        marker: MINUS,
        oldLine: formatLineNumber(row.oldLine),
        newLine: '',
      };
    default:
      return {
        className: 'str-editor-row is-context',
        label: hasLineNumber(row.newLine)
          ? `context line ${row.newLine}`
          : hasLineNumber(row.oldLine)
            ? `context line ${row.oldLine}`
            : 'context line',
        marker: '',
        oldLine: formatLineNumber(row.oldLine),
        newLine: formatLineNumber(row.newLine),
      };
  }
};

const PreviewView = ({ rows }) => (
  <section
    className="str-editor"
    role="region"
    aria-label="Viewed source"
    tabIndex={0}
  >
    <div className="str-editor-table">
      {rows.map((row, index) => {
        const gutters = previewRowGutters(row);
        return (
          <div className="str-editor-row is-context" key={`preview-${index}`}>
            <span className="str-editor-gutter str-editor-gutter-old">{gutters.oldLine}</span>
            <span className="str-editor-gutter str-editor-gutter-new">{gutters.newLine}</span>
            <span className="str-editor-marker" aria-hidden="true" />
            <code className="str-editor-code">{row.text}</code>
          </div>
        );
      })}
    </div>
  </section>
);

const DiffView = ({ rows }) => (
  <section
    className="str-editor"
    role="region"
    aria-label="Changes"
    tabIndex={0}
  >
    <div className="str-editor-table" role="list">
      {rows.map((row, index) => {
        const meta = diffRowMeta(row);
        return (
          <div
            className={meta.className}
            role="listitem"
            aria-label={meta.label}
            key={`diff-${index}`}
          >
            <span className="str-editor-gutter str-editor-gutter-old">{meta.oldLine}</span>
            <span className="str-editor-gutter str-editor-gutter-new">{meta.newLine}</span>
            <span className="str-editor-marker" aria-hidden="true">
              {meta.marker}
            </span>
            <code className="str-editor-code">{row.text}</code>
          </div>
        );
      })}
    </div>
  </section>
);

const ListingView = ({ lines }) => (
  <section
    className="str-editor"
    role="region"
    aria-label="Directory contents"
    tabIndex={0}
  >
    <ul className="str-editor-listing">
      {lines.map((line, index) => (
        <li className="str-editor-listing-item" key={`listing-${index}`}>
          <code className="str-editor-code">{line}</code>
        </li>
      ))}
    </ul>
  </section>
);

const ErrorView = ({ message }) => (
  <div className="str-editor str-editor-error" role="alert" tabIndex={0}>
    <p className="str-editor-error-title">Tool call failed</p>
    <pre className="str-editor-pre">{message ?? ''}</pre>
  </div>
);

const FallbackView = ({ content }) => (
  <section
    className="str-editor"
    role="region"
    aria-label="Tool output"
    tabIndex={0}
  >
    <pre className="str-editor-pre">{content ?? ''}</pre>
  </section>
);

const StrReplaceEditorView = ({ presentation }) => {
  if (!presentation || typeof presentation !== 'object') {
    return null;
  }

  switch (presentation.kind) {
    case 'preview':
      return <PreviewView rows={toRows(presentation.rows)} />;
    case 'diff':
      return <DiffView rows={toRows(presentation.rows)} />;
    case 'listing':
      return <ListingView lines={Array.isArray(presentation.lines) ? presentation.lines : []} />;
    case 'error':
      return <ErrorView message={presentation.message} />;
    case 'fallback':
      return <FallbackView content={presentation.content} />;
    default:
      return null;
  }
};

export default StrReplaceEditorView;
