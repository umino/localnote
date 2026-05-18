import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import { parseContent } from '../utils/content';
import { normalizeHref, isLocalPath } from '../utils/normalizeHref';

// ─── Search highlight extension ──────────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        searchHighlight: {
            setSearchHighlight: (term: string) => ReturnType;
        };
    }
}

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
}

interface RichEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    highlightQuery?: string | null;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
    ({ initialContent, onChange, highlightQuery }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit,
                Underline,
                TextStyle,
                Color,
                Link.configure({
                    openOnClick: false,
                    linkOnPaste: true,
                    autolink: true,
                    protocols: ['file'],
                    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
                }),
                Image.configure({ inline: false }),
                Placeholder.configure({ placeholder: 'Type something...' }),
                TaskList,
                TaskItem.configure({ nested: true }),
                SearchHighlightExtension,
            ],
            content: parseContent(initialContent),
            onUpdate({ editor }) {
                onChange(JSON.stringify(editor.getJSON()));
            },
            editorProps: {
                handleClick(_view, _pos, event) {
                    if (event.ctrlKey || event.metaKey) {
                        const target = event.target as HTMLElement;
                        const anchor = target.closest('a');
                        const href = anchor?.getAttribute('href');
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
