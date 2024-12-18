import { Dispatch, ReactNode, SetStateAction } from 'react';

export interface ILayout {
    children: ReactNode;
}

export type Mode = 'link' | 'folder';

export type IFile = Record<string, string>;

export interface IWordBox {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IThemeBox {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ISentenceBox {
    sentence: string;
    comment?: string;
    isMarked?: boolean;
    coded_word: string;
    postId: string;
    reasoning: string;
}

export interface IFinalCodeResponse {
    sentence: string;
    coded_word: string;
    postId: string;
    reasoning: string;
}

export interface IRedditPost {
    sentence: string;
    word: string;
    link: string;
    reason: string;
    context?: string; // Additional context information if necessary
}

export interface IRedditPostData {
    id: string;
    title: string;
    selftext: string;
    comments?: IComment[];
}

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ContentAreaTabs = 'data' | 'codes';

export interface IComment {
    id: string;
    body: string;
    comments?: IComment[];
}

export interface IReference {
    text: string;
    postId: string;
    isComment: boolean;
}

export type RedditPosts = {
    [id: string]: {
        over_18: boolean;
        subreddit: string;
        score: number;
        thumbnail: 'image';
        permalink: string;
        is_self: boolean;
        domain: 'i.redd.it';
        created_utc: number;
        url: string;
        num_comments: number;
        title: string;
        selftext: string;
        author: string;
        hide_score: boolean;
        subreddit_id: string;
    };
};

export type PostIdTitle = {
    id: string;
    title: string;
};

export type RedditComments = {
    [id: string]: {
        controversiality: number;
        score_hidden: false;
        body: string;
        score: number;
        created_utc: number;
        author: string;
        parent_id: string;
        subreddit_id: string;
        retrieved_on: number;
        gilded: number;
        link_id: string;
        subreddit: string;
        comments: RedditComments;
    };
};

export type FullRedditData = {
    [id: string]: RedditPosts[string] & { comments: RedditComments };
};

export interface CodebookEntry {
    word: string;
    description: string;
    codes?: string[];
    inclusion_criteria: string[];
    exclusion_criteria: string[];
    isMarked?: boolean;
}
