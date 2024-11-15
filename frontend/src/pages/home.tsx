import { FC, useContext } from "react";
import { DataContext } from "../context/data_context";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES } from "../constants/shared";

const { ipcRenderer } = window.require("electron");

export const HomePage: FC = () => {
	const dataContext = useContext(DataContext);

	// Function to handle input change and extract links
	const handleChange = (e: any) => {
		e.preventDefault();
		const text = e.target.value;
		console.log(text);
		dataContext.setModeInput(text);
	};

	const handleSelectFolder = async () => {
		try {
		// Request folder selection from main process
			const path = await ipcRenderer.invoke("select-folder");
			dataContext.setModeInput(path);
		} catch (error) {
			console.error("Failed to select folder:", error);
		}
  };


	return (
		<div className="w-full p-6 h-full flex justify-between flex-col">
		<div>
			<div>Load reddit</div>
			<button
				onClick={dataContext.toggleMode}  
				className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600"
			>
				{dataContext.currentMode === "link" ? "Switch to Folder" : "Switch to Link"}
			</button>
			{dataContext.currentMode==="link"?
			<div>
				<input
					type="text"
					value={dataContext.modeInput}
					onChange={handleChange}
					placeholder="Type or paste text with URLs here"
					className="p-2 border border-gray-300 rounded w-96"
				/>
			</div>:
			dataContext.currentMode==="folder"?
			<div>
				<button onClick={handleSelectFolder} className="p-2 border border-gray-300 rounded w-96">Select Folder</button>
					<div>
						<h3>Selected Folder:</h3>
						<p>{dataContext.modeInput || "No folder selected"}</p>
					</div>
			</div>:
			<></>}
			</div>
			<NavigationBottomBar nextPage={ROUTES.BASIS} isReady={dataContext.modeInput.length>0}/>
		</div>
	);
};
