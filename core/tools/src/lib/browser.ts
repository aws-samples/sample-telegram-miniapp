export function isBrowser() {

    return typeof window === 'object'
        && typeof window.document === 'object'
}