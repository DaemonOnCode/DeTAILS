export type TorrentFilesSelectedState = {
    [subreddit: string]: {
        posts: { [year: string]: boolean[] };
        comments: { [year: string]: boolean[] };
    };
};
