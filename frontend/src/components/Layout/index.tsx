import { FC } from "react";
import { Sidebar } from "../Shared/sidebar";
import { ILayout } from "../../types/shared";

export const Layout: FC<ILayout> = ({ children }) => {
	return (
		<div className="flex w-full relative">
			<Sidebar />
			<div className="pl-64 h-screen overflow-auto w-full">{children}</div>
		</div>
	);
};
