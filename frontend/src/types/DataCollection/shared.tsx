export type TorrentFilesSelectedState = {
    [subreddit: string]: {
        posts: { [year: string]: boolean[] };
        comments: { [year: string]: boolean[] };
    };
};

export type ModeType = 'reddit' | 'interview' | null;

export interface RedditMetadata {
    type: 'reddit';
    source: 'folder' | 'url';
    subreddit: string;
}

export interface InterviewMetadata {
    type: 'interview';
    source: 'folder';
}

export interface InterviewFile {
    fileName: string;
    filePath: string;
}

export type MetadataState = RedditMetadata | InterviewMetadata | null;

export type RedditData = any;
export type InterviewData = any;
export type Dataset = RedditData[] | InterviewData[];

export type MetadataAction =
    | { type: 'SET_SOURCE'; payload: 'folder' | 'url' }
    | { type: 'SET_SUBREDDIT'; payload: string }
    | { type: 'RESET_METADATA' };

export type DataAction =
    | { type: 'ADD_DATA'; payload: RedditData | InterviewData }
    | { type: 'RESET_DATA' };
