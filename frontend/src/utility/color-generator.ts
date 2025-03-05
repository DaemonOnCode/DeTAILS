export const generateColor = (key: string): string => {
    key = `${key}`;
    // Use the djb2 algorithm for a better hash distribution.
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) + hash + key.charCodeAt(i); // hash * 33 + charCode
    }
    // Ensure the hash is positive.
    hash = Math.abs(hash);

    // Hue: Generate a hue between 0 and 359.
    const hue = hash % 360;

    // Saturation: Generate a value between 55% and 75%.
    // (hash * 3) % 21 produces a value between 0 and 20.
    const saturation = 55 + ((hash * 3) % 21);

    // Lightness: Generate a value between 65% and 80%.
    // (hash * 5) % 16 produces a value between 0 and 15.
    const lightness = 65 + ((hash * 5) % 16);

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
