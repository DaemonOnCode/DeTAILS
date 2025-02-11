export const generateColor = (key: string): string => {
    // Basic hash
    const hash = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Generate a hue in [0..359]
    const hue = (hash * 37) % 360;

    // Choose a moderate saturation (say 40–60%) and high lightness (60–80%)
    // so the color is light and works well with black text.
    const saturation = 50;
    const lightness = 75;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
