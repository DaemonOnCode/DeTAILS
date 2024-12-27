export const generateColor = (key: string): string => {
    const hash = Array.from(key).reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const r = Math.min(((hash * 19) % 200) + 55, 255);
    const g = Math.min(((hash * 37) % 200) + 55, 255);
    const b = Math.min(((hash * 53) % 200) + 55, 255);

    const brightness = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);

    const opacity = Math.max(0.5, Math.min(1, 1 - brightness / 255));

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
