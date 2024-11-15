import { Dispatch, ReactNode, SetStateAction } from "react";

export interface ILayout {
	children: ReactNode;
}

export type Mode =  "link" | "folder";

export type IFile = Record<string, string>;

export interface IWordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISentenceBox {
  sentence: string;
  comment: string;
  isMarked?: boolean;
  coded_word: string;
}

export interface IRedditPost {
  sentence: string;
  word: string;
  link: string;
  reason: string;
  context?: string; // Additional context information if necessary
}

export interface IRedditPostData {
    id: number;
    title: string;
    body: string;
    comments?: IComment[];
}

export type SetState<T> = Dispatch<SetStateAction<T>>;

export type ContentAreaTabs = "data" | "codes";

export interface IComment {
  id: number;
  body: string;
  comments?: IComment[];
}

export interface IReference {
  text: string;
  postId: number;
  isComment: boolean;
}