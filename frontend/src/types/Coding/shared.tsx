import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Keyword } from '../Shared';

export interface ILayout {
    children: ReactNode;
}

export type Mode = 'link' | 'folder';

export type IFile = Record<string, string>;

export type InitialCodebookCode = {
    code: string;
    definition: string;
};

export interface IWordBox {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IKeywordBox {
    text: Keyword;
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

export interface IQECRow {
    id: string;
    quote: string;
    explanation: string;
    code: string;
    postId: string;
}

export enum ChatCommands {
    ACCEPT_QUOTE = 'ACCEPT_QUOTE',
    REMOVE_QUOTE = 'REMOVE_QUOTE',
    EDIT_QUOTE = 'EDIT_QUOTE',
    REVERT_TO_INITIAL = 'REVERT_TO_INITIAL'
}

export interface ChatMessage {
    id: number;
    text: string;
    sender: 'LLM' | 'Human';
    reaction?: boolean;
    isEditable?: boolean;
    isThinking?: boolean;
    code?: string;
    command?: keyof typeof ChatCommands;
    alternate_codes?: string[];
    isCurrentCode?: boolean;
}

export interface IQECResponse extends IQECRow {
    isMarked?: boolean;
    comment: string;
    chatHistory?: ChatMessage[];
    rangeMarker?: {
        itemId: string;
        range: [number, number];
    };
}

export interface IQECTRow extends IQECRow {
    theme: string;
}

export interface IQECTResponse extends IQECTRow {
    isMarked?: boolean;
    comment: string;
    chatHistory?: ChatMessage[];
    rangeMarker?: {
        itemId: string;
        range: [number, number];
    };
}

export interface IQECTTyRow extends IQECTRow {
    type: string;
}

export interface IQECTTyResponse extends IQECTTyRow {
    isMarked?: boolean;
    comment: string;
    chatHistory?: ChatMessage[];
    rangeMarker?: {
        itemId: string;
        range: [number, number];
    };
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

export type SetState<T> = Dispatch<SetStateAction<T>> | ((...value: any[]) => T);

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

export interface KeywordEntry {
    word: string;
    description: string;
    codes?: string[];
    inclusion_criteria: string;
    exclusion_criteria: string;
    isMarked?: boolean;
}

export type Comments = {
    author: string;
    body: string;
    comments: Comments[];
    controversiality: number;
    created_utc: number;
    dataset_id: string;
    gilded: number;
    id: string;
    parent_id: string;
    post_id: string;
    retrieved_on: number;
    score: number;
    score_hidden: boolean;
    subreddit_id: string;
};

export type ThemeBucket = {
    id: string;
    name: string;
    codes: string[];
};

export type GroupedCodeBucket = {
    id: string;
    name: string;
    codes: string[];
};

type Action<T> =
    | { type: 'SET_CORRECT'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_INCORRECT'; index: number }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'UPDATE_COMMENT'; index: number; comment: string }
    | { type: 'MARK_RESPONSE'; index: number; isMarked?: boolean }
    | { type: 'RERUN_CODING'; indexes: number[]; newResponses: T[] }
    | {
          type: 'ADD_RESPONSE';
          response: T;
      }
    | { type: 'ADD_RESPONSES'; responses: T[] }
    | (
          | { type: 'REMOVE_RESPONSES'; indexes: number[]; all?: never }
          | { type: 'REMOVE_RESPONSES'; all: boolean; indexes?: never }
      )
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'SET_RESPONSES'; responses: T[] }
    | { type: 'DELETE_CODE'; code: string }
    | { type: 'EDIT_CODE'; currentCode: string; newCode: string }
    | { type: 'DELETE_HIGHLIGHT'; postId: string; sentence: string; code: string }
    | {
          type: 'EDIT_HIGHLIGHT';
          postId: string;
          sentence: string;
          newSentence: string;
          code: string;
      };

export type KeywordsTableAction =
    | { type: 'INITIALIZE'; entries: KeywordEntry[] }
    | { type: 'ADD_MANY'; entries: KeywordEntry[] }
    | { type: 'UPDATE_FIELD'; index: number; field: keyof KeywordEntry; value: string | string[] }
    | { type: 'TOGGLE_MARK'; index: number; isMarked?: boolean }
    | { type: 'ADD_ROW'; entry?: KeywordEntry }
    | { type: 'DELETE_ROW'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'UNDO_DELETE_ROW'; entry: KeywordEntry; index: number }
    | { type: 'RESET' }
    | { type: 'RESTORE_STATE'; payload: KeywordEntry[] };

export type BaseResponseHandlerActions<T> =
    | { type: 'SET_CORRECT'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'SET_INCORRECT'; index: number }
    | { type: 'UPDATE_COMMENT'; index: number; comment: string }
    | { type: 'MARK_RESPONSE'; index: number; isMarked?: boolean }
    | {
          type: 'MARK_RESPONSE_BY_CODE_EXPLANATION';
          code: string;
          quote: string;
          postId: string;
          isMarked?: boolean;
      }
    | { type: 'RERUN_CODING'; indexes: number[]; newResponses: T[] }
    | {
          type: 'ADD_RESPONSE';
          response: T;
      }
    | { type: 'ADD_RESPONSES'; responses: T[] }
    | (
          | { type: 'REMOVE_RESPONSES'; indexes: number[]; all?: never }
          | { type: 'REMOVE_RESPONSES'; all: boolean; indexes?: never }
      )
    | { type: 'SET_RESPONSES'; responses: T[] }
    | { type: 'SET_PARTIAL_RESPONSES'; responses: T[] }
    | { type: 'DELETE_CODE'; code: string }
    | { type: 'EDIT_CODE'; currentCode: string; newCode: string }
    | { type: 'DELETE_HIGHLIGHT'; postId: string; sentence: string; code: string }
    | {
          type: 'EDIT_HIGHLIGHT';
          postId: string;
          sentence: string;
          newSentence: string;
          code: string;
          rangeMarker?: { itemId: string; quote: string; range: [number, number] }[];
      }
    | {
          type: 'SET_CHAT_HISTORY';
          postId?: string;
          sentence?: string;
          code?: string;
          chatHistory?: ChatMessage[];
      }
    | { type: 'UPDATE_CODE'; newCode: string; quote: string; prevCode: string }
    | { type: 'RESET' }
    | {
          type: 'UPSERT_MARKER';
          quote: string;
          rangeMarker: { itemId: string; quote: string; range: [number, number] }[];
          postId: string;
          code: string;
      }
    | {
          type: 'SYNC_CHAT_STATE';
          postId: string;
          quote: string;
          refresh?: boolean;
          currentCode?: string;
          prevCode: string;
          chatHistory: ChatMessage[];
          isMarked?: boolean;
      }
    | { type: 'RESTORE_STATE'; payload: T[] };

export type SampleDataResponseReducerActions = BaseResponseHandlerActions<IQECResponse>;
// | { type: 'UPDATE_CODE'; newCode: string; quote: string; prevCode: string };

export type SampleDataWithThemeResponseReducerActions =
    | BaseResponseHandlerActions<IQECTResponse>
    | { type: 'UPDATE_THEMES'; themes: ThemeBucket[] }
    | { type: 'DELETE_THEME'; name: string };

export type PostItem = {
    postId: string;
    quote: string;
    coded_word: string;
    reasoning: string;
    theme: string;
    id: string;
};

export type Segment = {
    line: string;
    id: string;
    type: 'title' | 'selftext' | 'comment' | 'reply';
    parent_id: string | null;
    backgroundColours: string[];
    relatedCodeText: string[];
    fullText: string[];
    index: number | string;
    codeQuotes: Record<string, string>;
    codeToOriginalQuotes?: Record<string, string[]>;
};

export type PageState = {
    isLoading: boolean;
    relevantStates: any[];
    relevantStateUpdaters: Record<string, (...args: any[]) => void>;
};

export type PagesState = {
    [route: string]: PageState;
};

export type PagesAction =
    | {
          type: 'UPDATE_PAGE_STATE';
          route: string;
          payload: Partial<PageState>;
      }
    | {
          type: 'RESET_AFTER';
          currentRoute: string;
      }
    | {
          type: 'RESET_BEFORE';
          currentRoute: string;
      }
    | {
          type: 'INITIALIZE';
          order: string[];
          pages: PagesState;
      };

export type Explanation = {
    explanation: string;
    code: string;
    fullText: string;
};

export type InitialCodebookTableAction =
    | { type: 'INITIALIZE'; entries: InitialCodebookCode[] }
    | { type: 'ADD_MANY'; entries: InitialCodebookCode[] }
    | {
          type: 'UPDATE_FIELD';
          index: number;
          field: keyof InitialCodebookCode;
          value: string | string[];
      }
    | { type: 'ADD_ROW'; entry?: InitialCodebookCode }
    | { type: 'RESET' }
    | { type: 'RESTORE_STATE'; payload: InitialCodebookCode[] };

export type BaseBucketAction =
    | { type: 'ADD_BUCKET' }
    | { type: 'DELETE_BUCKET'; payload: string }
    | { type: 'MOVE_CODE'; payload: { code: string; targetBucketId: string } }
    | { type: 'MOVE_UNPLACED_TO_MISC' }
    | { type: 'RESTORE_STATE'; payload: GroupedCodeBucket[] | ThemeBucket[] };
