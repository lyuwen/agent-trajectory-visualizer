import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StrReplaceEditorView from '../components/StrReplaceEditorView';

const MINUS = '\u2212';

const previewPresentation = {
  kind: 'preview',
  action: 'view',
  path: 'src/app.js',
  rows: [
    { type: 'context', oldLine: 1, newLine: 1, text: 'const a = 1;' },
    { type: 'context', oldLine: 2, newLine: 2, text: 'return a;' },
  ],
};

const diffPresentation = {
  kind: 'diff',
  action: 'str_replace',
  path: 'src/app.js',
  rows: [
    { type: 'context', oldLine: 3, newLine: 3, text: 'function run() {' },
    { type: 'remove', oldLine: 4, newLine: null, text: 'const b = 2;' },
    { type: 'add', oldLine: null, newLine: 4, text: 'const b = 3;' },
    { type: 'context', oldLine: 5, newLine: 5, text: 'return b;' },
  ],
};

const listingPresentation = {
  kind: 'listing',
  action: 'view',
  path: 'src',
  lines: ['src/app.js', 'src/helpers.js', 'README.md'],
};

describe('StrReplaceEditorView', () => {
  it('renders nothing for a null, unknown, or missing presentation', () => {
    const { container: nullCase } = render(<StrReplaceEditorView presentation={null} />);
    expect(nullCase).toBeEmptyDOMElement();

    const { container: unknownCase } = render(
      <StrReplaceEditorView presentation={{ kind: 'mystery', action: 'view', path: 'x' }} />
    );
    expect(unknownCase).toBeEmptyDOMElement();

    const { container: missingCase } = render(<StrReplaceEditorView />);
    expect(missingCase).toBeEmptyDOMElement();
  });

  it('renders a preview region with both gutters and no diff markers', () => {
    const { container } = render(<StrReplaceEditorView presentation={previewPresentation} />);

    const region = screen.getByRole('region', { name: 'Viewed source' });
    expect(region).toBeTruthy();

    expect(screen.getByText('const a = 1;')).toBeTruthy();
    expect(screen.getByText('return a;')).toBeTruthy();

    const gutters = region.querySelectorAll('.str-editor-gutter');
    expect(Array.from(gutters).map((gutter) => gutter.textContent)).toEqual(['1', '1', '2', '2']);

    const markers = region.querySelectorAll('.str-editor-marker');
    expect(markers).toHaveLength(2);
    markers.forEach((marker) => expect(marker.textContent).toBe(''));

    expect(container.querySelectorAll('code')).toHaveLength(2);
  });

  it('renders a diff region with labelled add, remove and neutral context rows', () => {
    render(<StrReplaceEditorView presentation={diffPresentation} />);

    const region = screen.getByRole('region', { name: 'Changes' });
    expect(region).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();

    const removed = screen.getByRole('listitem', { name: 'removed line 4' });
    expect(removed).toHaveTextContent('const b = 2;');
    expect(removed).toHaveTextContent(MINUS);
    expect(removed.querySelector('.str-editor-marker').textContent).toBe(MINUS);

    const added = screen.getByRole('listitem', { name: 'added line 4' });
    expect(added).toHaveTextContent('const b = 3;');
    expect(added.querySelector('.str-editor-marker').textContent).toBe('+');

    const context = screen.getByRole('listitem', { name: 'context line 3' });
    expect(context).toHaveTextContent('function run() {');
    expect(context.querySelector('.str-editor-marker').textContent).toBe('');
  });

  it('falls back to a bare label when a diff row has no line number', () => {
    render(
      <StrReplaceEditorView
        presentation={{
          kind: 'diff',
          action: 'str_replace',
          path: 'src/app.js',
          rows: [
            { type: 'remove', oldLine: null, newLine: null, text: 'gone' },
            { type: 'add', oldLine: null, newLine: null, text: 'fresh' },
            { type: 'context', oldLine: null, newLine: null, text: 'same' },
          ],
        }}
      />
    );

    expect(screen.getByLabelText('removed line')).toHaveTextContent('gone');
    expect(screen.getByLabelText('added line')).toHaveTextContent('fresh');
    expect(screen.getByLabelText('context line')).toHaveTextContent('same');
  });

  it('renders every directory entry verbatim, one item per line', () => {
    render(<StrReplaceEditorView presentation={listingPresentation} />);

    const region = screen.getByRole('region', { name: 'Directory contents' });
    listingPresentation.lines.forEach((entry) => {
      expect(region).toHaveTextContent(entry);
    });

    const items = region.querySelectorAll('li code');
    expect(items).toHaveLength(3);
    expect(Array.from(items).map((item) => item.textContent)).toEqual(listingPresentation.lines);
  });

  it('renders an error alert with the failure message verbatim and no diff', () => {
    const message = 'Error: old_str was not found in src/app.js';
    render(
      <StrReplaceEditorView
        presentation={{ kind: 'error', action: 'str_replace', path: 'src/app.js', message }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Tool call failed');
    expect(alert.querySelector('pre').textContent).toBe(message);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders fallback output as preformatted text', () => {
    const content = 'raw tool output\nsecond line';
    render(
      <StrReplaceEditorView
        presentation={{ kind: 'fallback', action: 'view', path: 'src/app.js', content }}
      />
    );

    const region = screen.getByRole('region', { name: 'Tool output' });
    const pre = region.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre.textContent).toBe(content);
  });

  it('keeps a 300-character diff line in a single text row', () => {
    const longText = 'x'.repeat(300);
    render(
      <StrReplaceEditorView
        presentation={{
          kind: 'diff',
          action: 'insert',
          path: 'src/app.js',
          rows: [{ type: 'add', oldLine: null, newLine: 7, text: longText }],
        }}
      />
    );

    const region = screen.getByRole('region', { name: 'Changes' });
    const codeCells = region.querySelectorAll('code');
    // jsdom has no layout: this only proves the long text stays one text node.
    // The no-wrap/horizontal-scroll behavior is verified in the browser pass.
    expect(codeCells).toHaveLength(1);
    expect(codeCells[0].textContent).toBe(longText);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('StrReplaceEditorView robustness', () => {
  it('does not throw for malformed rows or lines payloads', () => {
    expect(() =>
      render(<StrReplaceEditorView presentation={{ kind: 'diff', action: 'create', rows: 'nope' }} />)
    ).not.toThrow();
    expect(() =>
      render(
        <StrReplaceEditorView
          presentation={{ kind: 'preview', action: 'view', rows: [null, { oldLine: 1, newLine: 1, text: 'ok' }] }}
        />
      )
    ).not.toThrow();
    expect(() =>
      render(<StrReplaceEditorView presentation={{ kind: 'listing', action: 'view', lines: 'nope' }} />)
    ).not.toThrow();

    expect(screen.getByRole('region', { name: 'Changes' }).querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Viewed source' }).querySelectorAll('.str-editor-row')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Directory contents' }).querySelectorAll('li')).toHaveLength(0);
  });

  it('renders empty regions for empty row and line lists', () => {
    render(<StrReplaceEditorView presentation={{ kind: 'diff', action: 'str_replace', rows: [] }} />);
    render(<StrReplaceEditorView presentation={{ kind: 'preview', action: 'view', rows: [] }} />);
    render(<StrReplaceEditorView presentation={{ kind: 'listing', action: 'view', lines: [] }} />);

    expect(screen.getByRole('region', { name: 'Changes' }).querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Viewed source' }).querySelectorAll('.str-editor-row')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Directory contents' }).querySelectorAll('li')).toHaveLength(0);
  });

  it('renders a context row that only carries an old line number', () => {
    render(
      <StrReplaceEditorView
        presentation={{
          kind: 'diff',
          action: 'str_replace',
          rows: [{ type: 'context', oldLine: 12, newLine: null, text: 'only old' }],
        }}
      />
    );

    const row = screen.getByRole('listitem', { name: 'context line 12' });
    expect(row).toHaveTextContent('only old');
    expect(row.querySelector('.str-editor-gutter-old').textContent).toBe('12');
    expect(row.querySelector('.str-editor-gutter-new').textContent).toBe('');
  });

  it('treats non-finite line numbers as absent in gutters and labels', () => {
    render(
      <StrReplaceEditorView
        presentation={{
          kind: 'diff',
          action: 'str_replace',
          rows: [
            { type: 'remove', oldLine: NaN, newLine: null, text: 'gone' },
            { type: 'add', oldLine: null, newLine: Infinity, text: 'fresh' },
          ],
        }}
      />
    );

    expect(screen.getByRole('listitem', { name: 'removed line' })).toHaveTextContent('gone');
    expect(screen.getByRole('listitem', { name: 'added line' })).toHaveTextContent('fresh');
    expect(screen.queryByLabelText(/NaN|Infinity/)).toBeNull();
  });

  it('renders fallback and error views with missing text without throwing', () => {
    expect(() =>
      render(<StrReplaceEditorView presentation={{ kind: 'fallback', action: 'view' }} />)
    ).not.toThrow();
    expect(() =>
      render(<StrReplaceEditorView presentation={{ kind: 'error', action: 'view' }} />)
    ).not.toThrow();

    expect(screen.getByRole('region', { name: 'Tool output' }).querySelector('pre').textContent).toBe('');
    expect(screen.getByRole('alert').querySelector('pre').textContent).toBe('');
  });
});
