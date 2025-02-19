export const generateRandomText = (
    length: number,
    dashWeight: number = 0.89, // More natural dashes
    spaceWeight: number = 0.1, // More spaces for natural word spacing
    newlineWeight: number = 0.01 // Rare newlines for paragraph effect
): string => {
    let text = '';
    let word = '';

    for (let i = 0; i < length; i++) {
        const rand = Math.random();

        if (rand < dashWeight) {
            word += '-';
        } else if (rand < dashWeight + spaceWeight) {
            text += word + ' ';
            word = ''; // Reset word
        }

        if (Math.random() < newlineWeight && text.length > 30) {
            text += '\n';
        }
    }

    text += word;
    return text.trim();
};

export function generateRandomTextArray(): Array<' ' | '-'> {
    return Array.from({ length: 8 * 12 }, () => (Math.random() > 0.3 ? '-' : ' '));
}

export function generateRandomTextColumnsArray(idx: number): Array<' ' | '-'> {
    let t1 = ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
    let t2 = ['-', '-', '-', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
    let partialLineIndex = idx % 7;
    return Array.from({ length: 7 }, (_, i) => {
        if (i !== partialLineIndex) return t1;
        if (i === partialLineIndex) return t2;
        return t1;
    }).flat() as Array<' ' | '-'>;
}
