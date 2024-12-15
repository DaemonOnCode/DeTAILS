import React, { FC, useReducer } from "react";
import { useCodingContext } from "../../context/coding_context";
import NavigationBottomBar from "../../components/Coding/Shared/navigation_bottom_bar";
import { ROUTES } from "../../constants/Coding/shared";
import { FaTrash } from "react-icons/fa";
import { useCollectionContext } from "../../context/collection_context";

const { ipcRenderer } = window.require("electron");

const CodeBookPage: FC = () => {
    const { codeBook, dispatchCodeBook } = useCodingContext();
    const { datasetId } = useCollectionContext();

    // const handleGenerateMore = async() => {
    //     await ipcRenderer.invoke("connect-ws", datasetId);
    //     await ipcRenderer.invoke("disconnect-ws", datasetId);
    // };

    const isReadyCheck = codeBook.some((entry) => entry.isMarked === true);

    return (
        <div className="flex flex-col justify-between h-full">
            <div>
                <p>Please validate and manage the codeBook entries below:</p>
                <div className="max-h-[calc(100vh-15rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">Description</th>
                                {/* <th className="border border-gray-400 p-2">Codes</th> */}
                                <th className="border border-gray-400 p-2">Inclusion Criteria</th>
                                <th className="border border-gray-400 p-2">Exclusion Criteria</th>
                                <th className="border border-gray-400 p-2">Actions</th>
                                {/* <th className="border border-gray-400 p-2">Comments</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {codeBook.map((entry, index) => (
                                <tr key={index} className="text-center">
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.word}
                                            onChange={(e) =>
                                                dispatchCodeBook({
                                                    type: "UPDATE_FIELD",
                                                    index,
                                                    field: "theme",
                                                    value: e.target.value,
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.description}
                                            onChange={(e) =>
                                                dispatchCodeBook({
                                                    type: "UPDATE_FIELD",
                                                    index,
                                                    field: "description",
                                                    value: e.target.value,
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.inclusion_criteria.join(", ")}
                                            onChange={(e) =>
                                                dispatchCodeBook({
                                                    type: "UPDATE_FIELD",
                                                    index,
                                                    field: "inclusion_criteria",
                                                    value: e.target.value.split(","),
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.exclusion_criteria.join(", ")}
                                            onChange={(e) =>
                                                dispatchCodeBook({
                                                    type: "UPDATE_FIELD",
                                                    index,
                                                    field: "exclusion_criteria",
                                                    value: e.target.value.split(","),
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <div className="flex items-center justify-center space-x-2">
                                            {/* Correct Button */}
                                            <button
                                                className={`w-8 h-8 flex items-center justify-center rounded ${
                                                    entry.isMarked === true
                                                        ? "bg-green-500 text-white"
                                                        : "bg-gray-300 text-gray-500"
                                                }`}
                                                onClick={() =>
                                                    dispatchCodeBook({
                                                        type: "TOGGLE_MARK",
                                                        index,
                                                        isMarked: entry.isMarked !== true ? true : undefined,
                                                    })
                                                }
                                            >
                                                ✓
                                            </button>

                                            {/* Incorrect Button */}
                                            <button
                                                className={`w-8 h-8 flex items-center justify-center rounded ${
                                                    entry.isMarked === false
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-300 text-gray-500"
                                                }`}
                                                onClick={() =>
                                                    dispatchCodeBook({
                                                        type: "TOGGLE_MARK",
                                                        index,
                                                        isMarked: entry.isMarked !== false ? false : undefined,
                                                    })
                                                }
                                            >
                                                ✕
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700"
                                                onClick={() => dispatchCodeBook({ type: "DELETE_ROW", index })}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-center gap-x-6">
                    <button
                        onClick={() => dispatchCodeBook({ type: "ADD_ROW" })}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    >
                        Add New Row
                    </button>
                    <button
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                        // onClick={handleGenerateMore}
                    >
                        Generate more
                    </button>
                </div>
            </div>
            <NavigationBottomBar previousPage={ROUTES.THEME_CLOUD} nextPage={ROUTES.INITIAL_CODING} isReady={isReadyCheck}/>
        </div>
    );
};


export default CodeBookPage;
