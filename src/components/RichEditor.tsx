import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import dos from 'highlight.js/lib/languages/dos';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import { parseContent } from '../utils/content';
import { normalizeHref, isLocalPath, parseInternalLinkId } from '../utils/normalizeHref';

// ─── Resizable image ─────────────────────────────────────────────────────────
function ResizableImageView({ node, updateAttributes }: { node: any; updateAttributes: (a: Record<string, unknown>) => void }) {
    const imgRef = useRef<HTMLImageElement>(null);

    const onResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = node.attrs.width ?? imgRef.current?.offsetWidth ?? 300;

        const onMove = (ev: MouseEvent) => {
            const w = Math.max(40, Math.round(startWidth + ev.clientX - startX));
            updateAttributes({ width: w });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    return (
        <NodeViewWrapper>
            <div className="relative inline-block group/img max-w-full my-2" style={{ lineHeight: 0 }}>
                <img
                    ref={imgRef}
                    src={node.attrs.src}
                    alt={node.attrs.alt ?? ''}
                    title={node.attrs.title ?? undefined}
                    draggable={false}
                    style={{
                        width: node.attrs.width ? `${node.attrs.width}px` : undefined,
                        height: 'auto',
                        maxWidth: '100%',
                        display: 'block',
                        borderRadius: '0.5rem',
                    }}
                />
                <div
                    onMouseDown={onResizeMouseDown}
                    className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-white dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-500 rounded-sm shadow cursor-se-resize opacity-0 group-hover/img:opacity-100 transition-opacity"
                    title="ドラッグしてリサイズ"
                />
            </div>
        </NodeViewWrapper>
    );
}

const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: el => {
                    const w = el.getAttribute('width');
                    return w ? parseInt(w, 10) : null;
                },
                renderHTML: attrs => attrs.width ? { width: String(attrs.width) } : {},
            },
        };
    },
    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView);
    },
});

// ─── Code block with syntax highlight ────────────────────────────────────────
const lowlight = createLowlight(common);
lowlight.register({ dos });

const CODE_LANGUAGES = [
    { value: 'plaintext', label: 'Plain Text' },
    { value: 'cpp',        label: 'C++' },
    { value: 'c',          label: 'C' },
    { value: 'dos',        label: 'Batch (.bat)' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python',     label: 'Python' },
    { value: 'bash',       label: 'Bash/Shell' },
    { value: 'json',       label: 'JSON' },
    { value: 'html',       label: 'HTML' },
    { value: 'css',        label: 'CSS' },
    { value: 'sql',        label: 'SQL' },
    { value: 'rust',       label: 'Rust' },
    { value: 'go',         label: 'Go' },
];

function CodeBlockView({ node, updateAttributes }: { node: any; updateAttributes: (a: Record<string, unknown>) => void }) {
    return (
        <NodeViewWrapper as="div" className="relative my-3">
            <select
                value={node.attrs.language ?? 'plaintext'}
                onChange={e => updateAttributes({ language: e.target.value })}
                contentEditable={false}
                onMouseDown={e => e.stopPropagation()}
                className="absolute top-2 right-2 z-10 text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border-none cursor-pointer opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none transition-opacity"
            >
                {CODE_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                ))}
            </select>
            <pre className="hljs">
                <NodeViewContent />
            </pre>
        </NodeViewWrapper>
    );
}

// ─── Indent extension ────────────────────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        indent: {
            increaseIndent: () => ReturnType;
            decreaseIndent: () => ReturnType;
        };
        searchHighlight: {
            setSearchHighlight: (term: string) => ReturnType;
        };
    }
}

const INDENT_TYPES = ['paragraph', 'heading'];

const Indent = Extension.create({
    name: 'indent',

    addGlobalAttributes() {
        return [{
            types: INDENT_TYPES,
            attributes: {
                indent: {
                    default: 0,
                    parseHTML: (el) => {
                        const match = (el.getAttribute('style') ?? '').match(/margin-left:\s*([\d.]+)rem/);
                        return match ? Math.round(parseFloat(match[1]) / 1.5) : 0;
                    },
                    renderHTML: (attrs) => attrs.indent
                        ? { style: `margin-left: ${attrs.indent * 1.5}rem` }
                        : {},
                },
            },
        }];
    },

    addCommands() {
        return {
            increaseIndent: () => ({ tr, state, dispatch }) => {
                const { from, to } = state.selection;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (INDENT_TYPES.includes(node.type.name)) {
                        const indent = Math.min((node.attrs.indent ?? 0) + 1, 8);
                        if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
                    }
                });
                return true;
            },
            decreaseIndent: () => ({ tr, state, dispatch }) => {
                const { from, to } = state.selection;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (INDENT_TYPES.includes(node.type.name)) {
                        const indent = Math.max((node.attrs.indent ?? 0) - 1, 0);
                        if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
                    }
                });
                return true;
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-]': () => this.editor.commands.increaseIndent(),
            'Mod-[': () => this.editor.commands.decreaseIndent(),
        };
    },
});

// ─── Search highlight extension ──────────────────────────────────────────────

interface SearchHighlightState {
    term: string;
    decorations: DecorationSet;
}

const SearchHighlightKey = new PluginKey<SearchHighlightState>('searchHighlight');

function buildDecorations(doc: PmNode, term: string): Decoration[] {
    if (!term) return [];
    const result: Decoration[] = [];
    const termLower = term.toLowerCase();
    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const textLower = node.text.toLowerCase();
        let start = 0;
        let idx: number;
        while ((idx = textLower.indexOf(termLower, start)) !== -1) {
            result.push(
                Decoration.inline(pos + idx, pos + idx + term.length, {
                    class: 'search-highlight',
                })
            );
            start = idx + 1;
        }
    });
    return result;
}

const SearchHighlightExtension = Extension.create({
    name: 'searchHighlight',
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: SearchHighlightKey,
                state: {
                    init(): SearchHighlightState {
                        return { term: '', decorations: DecorationSet.empty };
                    },
                    apply(tr, pluginState, _old, newState): SearchHighlightState {
                        const meta = tr.getMeta(SearchHighlightKey) as { term: string } | undefined;
                        const term = meta?.term !== undefined ? meta.term : pluginState.term;
                        if (!term) return { term, decorations: DecorationSet.empty };
                        return {
                            term,
                            decorations: DecorationSet.create(newState.doc, buildDecorations(newState.doc, term)),
                        };
                    },
                },
                props: {
                    decorations(state) {
                        return SearchHighlightKey.getState(state)?.decorations ?? DecorationSet.empty;
                    },
                },
            }),
        ];
    },
    addCommands() {
        return {
            setSearchHighlight:
                (term: string) =>
                ({ tr, dispatch, view }) => {
                    if (dispatch) {
                        tr.setMeta(SearchHighlightKey, { term });
                        dispatch(tr);
                    }
                    if (term && view) {
                        requestAnimationFrame(() => {
                            const first = view.dom.querySelector<HTMLElement>('.search-highlight');
                            first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        });
                    }
                    return true;
                },
        };
    },
});

// ─── Component ───────────────────────────────────────────────────────────────
export interface RichEditorHandle {
    setContent: (content: string) => void;
    getText: () => string;
    toggleUnderline: () => void;
    isUnderlineActive: () => boolean;
    setColor: (color: string) => void;
    unsetColor: () => void;
    getCurrentColor: () => string | null;
    setLink: (url: string) => void;
    unsetLink: () => void;
    isLinkActive: () => boolean;
    getCurrentLink: () => string | null;
    insertInternalLink: (fileId: number, title: string) => void;
    insertTable: () => void;
    addRowBefore: () => void;
    addRowAfter: () => void;
    deleteRow: () => void;
    addColumnBefore: () => void;
    addColumnAfter: () => void;
    deleteColumn: () => void;
    deleteTable: () => void;
    increaseIndent: () => void;
    decreaseIndent: () => void;
}

interface RichEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    highlightQuery?: string | null;
    onInternalLinkClick?: (fileId: number) => void;
    onTableStateChange?: (inTable: boolean) => void;
    onBlockquoteStateChange?: (inBlockquote: boolean) => void;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
    ({ initialContent, onChange, highlightQuery, onInternalLinkClick, onTableStateChange, onBlockquoteStateChange }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit.configure({ codeBlock: false }),
                Underline,
                TextStyle,
                Color,
                Link.configure({
                    openOnClick: false,
                    linkOnPaste: true,
                    autolink: true,
                    protocols: ['file', 'note'],
                    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
                }),
                ResizableImage.configure({ inline: false }),
                Placeholder.configure({ placeholder: 'Type something...' }),
                TaskList,
                TaskItem.configure({ nested: true }),
                CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }).extend({
                    addNodeView() { return ReactNodeViewRenderer(CodeBlockView); },
                }),
                Table.configure({ resizable: true }),
                TableRow,
                TableHeader,
                TableCell,
                Indent,
                SearchHighlightExtension,
            ],
            content: parseContent(initialContent),
            onUpdate({ editor }) {
                onChange(JSON.stringify(editor.getJSON()));
            },
            onSelectionUpdate({ editor }) {
                onTableStateChange?.(editor.isActive('tableCell') || editor.isActive('tableHeader'));
                onBlockquoteStateChange?.(editor.isActive('blockquote'));
            },
            editorProps: {
                handleClick(_view, _pos, event) {
                    const target = event.target as HTMLElement;
                    const anchor = target.closest('a');
                    const href = anchor?.getAttribute('href');

                    if (href?.startsWith('note://')) {
                        // Internal page links: single click, prevent browser navigation
                        event.preventDefault();
                        const id = parseInternalLinkId(href);
                        if (id !== null) onInternalLinkClick?.(id);
                        return true;
                    }

                    if (event.ctrlKey || event.metaKey) {
                        if (href) {
                            if (href.startsWith('file://')) {
                                // Browsers block file:// navigation from http(s) contexts.
                                // Copy the decoded path to clipboard as a reliable fallback.
                                window.open(href, '_blank');
                                const path = decodeURIComponent(
                                    href.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '//')
                                );
                                navigator.clipboard.writeText(path).then(
                                    () => toast.info(`パスをコピーしました: ${path}`, { duration: 4000 }),
                                    () => toast.error('クリップボードへのコピーに失敗しました'),
                                );
                            } else {
                                window.open(href, '_blank', 'noopener,noreferrer');
                            }
                            return true;
                        }
                    }
                    return false;
                },
                handlePaste(view, event) {
                    // Image paste
                    const items = Array.from(event.clipboardData?.items ?? []);
                    const imageItem = items.find(item => item.type.startsWith('image/'));
                    if (imageItem) {
                        event.preventDefault();
                        const file = imageItem.getAsFile();
                        if (!file) return false;
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const src = e.target?.result as string;
                            if (!src) return;
                            const { schema, tr } = view.state;
                            const node = schema.nodes.image?.create({ src });
                            if (!node) return;
                            view.dispatch(tr.replaceSelectionWith(node));
                        };
                        reader.readAsDataURL(file);
                        return true;
                    }
                    // Local file path paste: wrap selection or insert as linked text
                    const text = event.clipboardData?.getData('text/plain')?.trim() ?? '';
                    if (text && !text.includes('\n') && isLocalPath(text)) {
                        const href = normalizeHref(text);
                        const { state } = view;
                        const linkMarkType = state.schema.marks.link;
                        if (linkMarkType) {
                            const { from, to, empty } = state.selection;
                            const linkMark = linkMarkType.create({ href, target: '_blank', rel: 'noopener noreferrer' });
                            const tr = state.tr;
                            if (!empty) {
                                tr.addMark(from, to, linkMark);
                            } else {
                                tr.replaceSelectionWith(state.schema.text(text, [linkMark]));
                            }
                            view.dispatch(tr);
                            return true;
                        }
                    }
                    return false;
                },
            },
        });

        useEffect(() => {
            if (!editor) return;
            editor.commands.setSearchHighlight(highlightQuery ?? '');
        }, [editor, highlightQuery]);

        useImperativeHandle(ref, () => ({
            setContent: (content: string) => {
                editor?.commands.setContent(parseContent(content), { emitUpdate: false });
            },
            getText: () => editor?.getText() ?? '',
            toggleUnderline: () => { editor?.chain().focus().toggleUnderline().run(); },
            isUnderlineActive: () => editor?.isActive('underline') ?? false,
            setColor: (color: string) => { editor?.chain().focus().setColor(color).run(); },
            unsetColor: () => { editor?.chain().focus().unsetColor().run(); },
            getCurrentColor: () => editor?.getAttributes('textStyle').color ?? null,
            setLink: (url: string) => { editor?.chain().focus().setLink({ href: url }).run(); },
            unsetLink: () => { editor?.chain().focus().unsetLink().run(); },
            isLinkActive: () => editor?.isActive('link') ?? false,
            getCurrentLink: () => editor?.getAttributes('link').href ?? null,
            insertInternalLink: (fileId: number, title: string) => {
                if (!editor) return;
                const href = `note://${fileId}`;
                const { state, view } = editor;
                const linkMarkType = state.schema.marks.link;
                if (!linkMarkType) return;
                const { from, to, empty } = state.selection;
                const linkMark = linkMarkType.create({ href });
                const tr = state.tr;
                if (!empty) {
                    tr.addMark(from, to, linkMark);
                } else {
                    tr.replaceSelectionWith(state.schema.text(title, [linkMark]));
                }
                view.dispatch(tr);
                view.focus();
            },
            insertTable: () => {
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            },
            addRowBefore:    () => { editor?.chain().focus().addRowBefore().run(); },
            addRowAfter:     () => { editor?.chain().focus().addRowAfter().run(); },
            deleteRow:       () => { editor?.chain().focus().deleteRow().run(); },
            addColumnBefore: () => { editor?.chain().focus().addColumnBefore().run(); },
            addColumnAfter:  () => { editor?.chain().focus().addColumnAfter().run(); },
            deleteColumn:    () => { editor?.chain().focus().deleteColumn().run(); },
            deleteTable:     () => { editor?.chain().focus().deleteTable().run(); },
            increaseIndent:  () => { editor?.chain().focus().increaseIndent().run(); },
            decreaseIndent:  () => { editor?.chain().focus().decreaseIndent().run(); },
        }), [editor]);

        if (!editor) return null;

        return (
            <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                <EditorContent
                    editor={editor}
                    className="tiptap-content flex-1 px-8 md:px-12 py-8"
                />
            </div>
        );
    }
);

RichEditor.displayName = 'RichEditor';
