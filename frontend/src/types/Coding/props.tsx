import {
    ContentAreaTabs,
    IRedditPostData,
    IReference,
    PostIdTitle,
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
    setIsHighlightModalOpen: SetState<boolean>;
    setCodes: SetState<string[]>;
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
