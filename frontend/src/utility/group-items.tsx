export function groupByPostId<T extends { postId: string }>(items: T[]): Record<string, T[]> {
    return items.reduce(
        (acc, item) => {
            if (!acc[item.postId]) {
                acc[item.postId] = [];
            }
            acc[item.postId].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}

export function groupByCode<T extends { coded_word: string }>(items: T[]): Record<string, T[]> {
    return items.reduce(
        (acc, item) => {
            if (!acc[item.coded_word]) {
                acc[item.coded_word] = [];
            }
            acc[item.coded_word].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}
