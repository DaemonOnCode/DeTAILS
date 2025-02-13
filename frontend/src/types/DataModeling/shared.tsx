export interface IModelState {
    id: string;
    name: string;
    type: 'lda' | 'nmf' | 'bertopic' | 'biterm';
    isProcessing: boolean;
    numTopics: number;
    state?: 'known' | 'unknown';
    stage: string | null;
}
