export function normalizeHref(raw: string): string {
    const s = raw.trim();
    if (!s) return s;
    // Already has a URL scheme with //
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(s)) return s;
    // mailto: scheme
    if (/^mailto:/i.test(s)) return s;
    // Windows absolute path: C:\ or C:/
    if (/^[A-Za-z]:[/\\]/.test(s)) return 'file:///' + s.replace(/\\/g, '/');
    // UNC path: \\server\share
    if (s.startsWith('\\\\')) return 'file:' + s.replace(/\\/g, '/');
    // Unix/Mac absolute path
    if (s.startsWith('/')) return 'file://' + s;
    // Fallback: assume https
    return 'https://' + s;
}

export function isLocalPath(s: string): boolean {
    return (
        /^file:\/\//i.test(s) ||
        /^[A-Za-z]:[/\\]/.test(s) ||
        s.startsWith('\\\\') ||
        (s.startsWith('/') && s.length > 1 && !s.startsWith('//'))
    );
}

export function isInternalLink(href: string): boolean {
    return href.startsWith('note://');
}

export function parseInternalLinkId(href: string): number | null {
    const id = parseInt(href.slice(7), 10);
    return isNaN(id) ? null : id;
}
