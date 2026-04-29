export function parseContent(raw: string): object | string {
    if (!raw) return '';
    try {
        return JSON.parse(raw);
    } catch {
        const lines = raw.split('\n');
        return {
            type: 'doc',
            content: lines.map(line => ({
                type: 'paragraph',
                ...(line ? { content: [{ type: 'text', text: line }] } : {}),
            })),
        };
    }
}

export function extractText(raw: string): string {
    try {
        const doc = JSON.parse(raw);
        const parts: string[] = [];
        function walk(node: any) {
            if (node.type === 'text' && node.text) parts.push(node.text);
            if (node.content) node.content.forEach(walk);
        }
        walk(doc);
        return parts.join('\n');
    } catch {
        return raw;
    }
}

export function extractTextPreview(raw: string, maxLength = 200): string {
    const text = extractText(raw).trim();
    return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}
