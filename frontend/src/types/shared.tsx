import { ReactNode } from "react";

export interface ILayout {
	children: ReactNode;
}

export type Mode =  "link" | "folder";

export type IFile = Record<string, string>;