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
