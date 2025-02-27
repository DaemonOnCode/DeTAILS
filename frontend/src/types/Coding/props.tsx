import { Dispatch } from 'react';
import {
    Comments,
    ContentAreaTabs,
    IQECResponse,
    IQECRow,
    IQECTResponse,
    IQECTRow,
    IQECTTyResponse,
    IRedditPostData,
    IReference,
    PostIdTitle,
    PostItem,
    RedditPosts,
    SetState
} from './shared';

export type PaginationControlsProps = {
    currentPage: number;
    totalPages: number;
    onNext: () => void;
    onPrevious: () => void;
};

export type RedditTableProps = {
    data: [string, RedditPosts[string]][]; // Post data as [id, postDetails]
    selectedPosts: string[]; // Set of selected post IDs
    togglePostSelection: (id: string) => void; // Function to toggle individual post selection
    toggleSelectPage: (pageData: [string, RedditPosts[string]][]) => void; // Function to toggle all posts on the page
    isLoading: boolean; // Flag to indicate if data is loading
};

export type AddCodeModalProps = {
    setIsAddCodeModalOpen: SetState<boolean>;
    setCodes: SetState<string[]>;
    setSelectedCode: SetState<string>;
    setAddHighlightModalHidden: SetState<boolean>;
};

export type EditCodeModalProps = {
    setIsEditCodeModalOpen: SetState<boolean>;
    setIsHighlightModalOpen: SetState<boolean>;
    setCodes: SetState<string[]>;
    codes: string[];
    setSelectedCode: SetState<string>;
};

export type DeleteCodeModalProps = {
    setIsDeleteCodeModalOpen: SetState<boolean>;
    setIsHighlightModalOpen: SetState<boolean>;
    setCodes: SetState<string[]>;
    codes: string[];
    setSelectedCode: SetState<string>;
};

export type ContentAreaProps = {
    selectedPost: PostIdTitle | null;
    selectedCodeForReferences: string | null;
    references: Record<string, IReference[]>;
    handleReferenceClick: (postId: string) => void;
    handleTextSelection: () => void;
    selectedPostData: IRedditPostData | null;
    setSelectedPostData: SetState<IRedditPostData | null>;
};

export type HighlightModalProps = {
    codes: string[];
    selectedCode: string;
    setSelectedCode: SetState<string>;
    setIsAddCodeModalOpen: SetState<boolean>;
    applyCodeToSelection: () => void;
    setIsHighlightModalOpen: SetState<boolean>;
    addReasoning?: boolean;
    reasoning?: string;
    setReasoning?: SetState<string>;
    restoreSelection: () => void;
    removeSelection: () => void;
    hidden: boolean;
    setHidden: SetState<boolean>;
};

export type EditHighlightModalProps = {
    references: {
        [code: string]: IReference[];
    };
    applyCodeToSelection: (e: any) => void;
    setIsHighlightModalOpen: SetState<boolean>;
    selectedText: string | null;
    setSelectedText: SetState<string | null>;
};

export type DeleteHighlightModalProps = {
    references: {
        [code: string]: IReference[];
    };
    setReferences: SetState<{
        [code: string]: IReference[];
    }>;
    applyCodeToSelection: (e: any) => void;
    setIsHighlightModalOpen: SetState<boolean>;
};

export type LeftPanelProps = {
    selectedTab: ContentAreaTabs;
    setSelectedTab: SetState<ContentAreaTabs>;
    posts: PostIdTitle[];
    setSelectedPost: SetState<PostIdTitle | null>;
    codes: string[];
    setSelectedCodeForReferences: SetState<string | null>;
};

export type TopToolbarProps = {
    selectedPost: PostIdTitle | null;
    setIsAddCodeModalOpen: SetState<boolean>;
    setIsHighlightModalOpen: SetState<boolean>;
    setIsEditCodeModalOpen: SetState<boolean>;
    setIsDeleteCodeModalOpen: SetState<boolean>;
    setIsEditHighlightCodeModalOpen: SetState<boolean>;
    setIsDeleteHighlightCodeModalOpen: SetState<boolean>;
    activeTranscript?: 'human' | 'llm' | null;
    showCodebookButton?: boolean; // Optional prop to control the Codebook button
    showCodebook?: boolean; // Optional prop to control the Codebook visibility
    onShowCodebook?: (e: any) => void; // Callback function for showing the codebook
};

export type FileCardProps = {
    filePath: string;
    fileName: string;
    onRemove: (file: string) => void;
};

export type NavigationBottomBarProps = {
    isReady?: boolean;
    previousPage?: string;
    nextPage?: string;
    onNextClick?: (e: any) => Promise<void>;
    onPreviousClick?: () => void;
    autoNavigateToNext?: boolean;
    disabledTooltipText?: string;
};

export type RedditViewModalProps = {
    postLink: string;
    isViewOpen: boolean | null;
    postText?: string;
    closeModal?: () => void;
    postId?: string;
};

export type WordCloudProps = {
    mainCode: string;
    words: string[];
    selectedWords: string[];
    toggleWordSelection: (word: string) => void;
};

export type ThemeCloudProps = {
    mainCode: string;
    themes: string[];
    selectedThemes: string[];
    toggleThemeSelection: (theme: string) => void;
    setThemes: SetState<string[]>;
};

export type KeywordCloudProps = {
    mainTopic: string;
    keywords: string[];
    selectedKeywords: string[];
    toggleKeywordSelection: (keyword: string) => void;
    setKeywords: SetState<string[]>;
};

export type PostTranscriptProps = {
    post: {
        author: string;
        comments: Comments[];
        created_utc: number;
        dataset_id: string;
        domain: string;
        hide_score: boolean;
        id: string;
        is_self: boolean;
        num_comments: number;
        over_18: boolean;
        permalink: string;
        score: number;
        selftext: string;
        subreddit: string;
        subreddit_id: string;
        thumbnail: string;
        title: string;
        url: string;
    };
    onBack: () => void;
    review?: boolean;
    isActive?: boolean;
    codeResponses: (IQECTResponse | IQECResponse | IQECTTyResponse)[];
    extraCodes?: string[];
    dispatchCodeResponse: Dispatch<any>;
    selectedText: string | null;
    setSelectedText: SetState<string | null>;
    conflictingCodes?: {
        code: string;
        explanation: string;
        quote: string;
    }[];
    handleSwitchToEditMode?: () => void;
    isAddCodeModalOpen: boolean;
    setIsAddCodeModalOpen: SetState<boolean>;
    isEditCodeModalOpen: boolean;
    setIsEditCodeModalOpen: SetState<boolean>;
    isDeleteCodeModalOpen: boolean;
    setIsDeleteCodeModalOpen: SetState<boolean>;
    isHighlightModalOpen: boolean;
    setIsHighlightModalOpen: SetState<boolean>;
    isEditHighlightModalOpen: boolean;
    setIsEditHighlightModalOpen: SetState<boolean>;
    isDeleteHighlightModalOpen: boolean;
    setDeleteIsHighlightModalOpen: SetState<boolean>;
};

export interface CodeViewProps {
    allCodes: string[];
    groupedByCode: Record<string, PostItem[]>;
    summaryView?: boolean;
    totalColumns?: number;
    handleViewPost: (postId: string, sentence: string) => void;
}

export interface PostViewProps {
    allPostIds: string[];
    grouped: Record<string, PostItem[]>;
    handleViewPost: (postId: string, sentence: string) => void;
    totalColumns?: number;
    summaryView?: boolean;
}
