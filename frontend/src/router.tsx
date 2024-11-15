import { FC } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/home";
import { NotFound } from "./pages/not_found";
import BasisPage from "./pages/basis";
import WordCloud from "./pages/word_cloud";

export const Router: FC = () => {
	return (
		<HashRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/basis" element={<BasisPage />} />
				<Route path="/word_cloud" element={<WordCloud />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</HashRouter>
	);
};
