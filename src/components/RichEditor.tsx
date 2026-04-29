import { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { parseContent } from '../utils/content';

export interface RichEditorHandle {
    setContent: (content: string) => void;
    getText: () => string;
}

interface RichEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
    ({ initialContent, onChange }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit,
                Image.configure({ inline: false }),
                Placeholder.configure({ placeholder: 'Type something...' }),
                TaskList,
                TaskItem.configure({ nested: true }),
            ],
            content: parseContent(initialContent),
            onUpdate({ editor }) {
                onChange(JSON.stringify(editor.getJSON()));
            },
            editorProps: {
                handlePaste(view, event) {
                    const items = Array.from(event.clipboardData?.items ?? []);
                    const imageItem = items.find(item => item.type.startsWith('image/'));
                    if (!imageItem) return false;
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
                },
            },
        });

        useImperativeHandle(ref, () => ({
            setContent: (content: string) => {
                editor?.commands.setContent(parseContent(content), { emitUpdate: false });
            },
            getText: () => editor?.getText() ?? '',
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
