import { useContext } from "react";
import { Layout } from "../components/Layout";
import { DataContext } from "../context/data_context";
import FileCard from "../components/Shared/file_card";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES } from "../constants/shared";

const BasisPage = () => {
    const dataContext = useContext(DataContext);

    const { basisFiles, addBasisFile, searchText, setSearchText } = dataContext;


    const checkIfReady = Object.keys(basisFiles).length > 0 && searchText?.length !== 0;

    const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("Selecting files");
        if (!e.target.files) {
            return;
        }
        const files: File[] = Array.from(e.target.files);
        files.forEach((file) => {
            addBasisFile((file as any).path, file.name);
        });
    }

    console.log(dataContext.currentMode, dataContext.modeInput);
    return (
        <div className="w-full px-4 py-6">
            <section className="">
                {Object.keys(basisFiles).length===0?<>
                    <h1>Select basis pdf?</h1>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        multiple={true}
                        onChange={handleSelectFiles}
                        className="p-2 border border-gray-300 rounded w-96 my-5"
                    />
                </>:<>
                    <h1>Selected basis files</h1>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-10">
                        {Object.keys(basisFiles).map((filePath, index) => <FileCard key={index} filePath={filePath} fileName={basisFiles[filePath]} onRemove={dataContext.removeBasisFile} />)}
                        <label className="flex items-center justify-center h-32 w-32 border rounded shadow-lg bg-white p-4 cursor-pointer text-blue-500 font-semibold hover:bg-blue-50">
                            <span>+ Add File</span>
                            <input
                                type="file"
                                multiple={true}
                                accept=".pdf,.doc,.docx,.txt"
                                onChange={(e) => handleSelectFiles(e)}
                                className="hidden"
                            />
                        </label>
                    </div>
                </>}

            </section>
            <div>
                <p>What are you looking for?</p>
                <input 
                    type="text" 
                    className="p-2 border border-gray-300 rounded w-96" 
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
            </div>
            <NavigationBottomBar previousPage={ROUTES.HOME} nextPage={ROUTES.WORD_CLOUD} isReady={checkIfReady}/>
        </div>
    );
};

export default BasisPage;