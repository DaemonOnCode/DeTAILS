import { FC, useReducer } from "react";
import { ROUTES } from "../constants/shared";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
// import { DataContext } from "../context/data_context";


interface SentenceBox {
  sentence: string;
  word: string;
  comment: string;
  isMarked?: boolean;
}

// Initial responses data
const initialResponses: SentenceBox[] = [
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
  { sentence: "This is the first sentence.", word: "first", comment: "" },
  { sentence: "Another example sentence.", word: "example", comment: "" },
  { sentence: "The validation example continues.", word: "validation", comment: "" },
];

// Define action types
type Action =
  | { type: "SET_CORRECT"; index: number }
  | { type: "SET_INCORRECT"; index: number }
  | { type: "UPDATE_COMMENT"; index: number; comment: string }
  | { type: "MARK_RESPONSE"; index: number; isMarked?: boolean};

// Reducer function to manage the state of responses
const responsesReducer = (state: SentenceBox[], action: Action): SentenceBox[] => {
  switch (action.type) {
    case "SET_CORRECT":
      return state.map((response, index) =>
        index === action.index
          ? { ...response, isCorrect: true, comment: "" }
          : response
      );
    case "SET_INCORRECT":
      return state.map((response, index) =>
        index === action.index ? { ...response, isCorrect: false } : response
      );
    case "UPDATE_COMMENT":
      return state.map((response, index) =>
        index === action.index ? { ...response, comment: action.comment } : response
      );
    case "MARK_RESPONSE":
      return state.map((response, index) =>
        index === action.index ? { ...response, isMarked: action.isMarked } : response
      );
    default:
      return state;
  }
};


const CodingValidationPage: FC = () => {
    // const dataContext = useContext(DataContext);

    const [responses, dispatch] = useReducer(responsesReducer, initialResponses);

    const handleCommentChange = (index: number, event: React.ChangeEvent<HTMLTextAreaElement>) => {
        dispatch({ type: "UPDATE_COMMENT", index, comment: event.target.value });
    };

    const handleMark = (index: number, isMarked?:boolean) => {
        dispatch({ type: "MARK_RESPONSE", index, isMarked });
    }

    const isReadyCheck = responses.some((response) => response.isMarked !== undefined);

    return (
        <div className="p-6 flex flex-col justify-between h-full">
            <div>
                <p>Please validate the following codings done by LLM </p>
                <div className="max-h-[calc(100vh-20rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 p-2">Sentence</th>
                            <th className="border border-gray-400 p-2">Word</th>
                            <th className="border border-gray-400 p-2">Actions</th>
                            <th className="border border-gray-400 p-2">Comment</th>
                        </tr>
                        </thead>
                        <tbody>
                        {responses.map((response, index) => (
                            <tr key={index} className="text-center">
                            <td className="border border-gray-400 p-2">{response.sentence}</td>
                            <td className="border border-gray-400 p-2">{response.word}</td>
                            <td className="border border-gray-400 p-2">
                                <button
                                className={`px-2 py-1 rounded mr-2 ${
                                    response.isMarked===true
                                    ? "bg-green-500 text-white"
                                    : "bg-gray-300 text-gray-500"
                                }`}
                                onClick={() => {
                                    console.log(response.isMarked);
                                    handleMark(index, response.isMarked!==true?true:undefined);
                                }}
                                >
                                ✓
                                </button>
                                <button
                                className={`px-2 py-1 rounded ${
                                    response.isMarked===false
                                    ? "bg-red-500 text-white"
                                    : "bg-gray-300 text-gray-500"
                                }`}
                                onClick={() => {
                                    console.log(response.isMarked);
                                    handleMark(index, response.isMarked!==false?false:undefined);
                                }}
                                >
                                ✕
                                </button>
                            </td>
                            <td className="border border-gray-400 p-2">
                                {response.isMarked === false && (
                                <textarea
                                    className="w-full p-2 border border-gray-300 rounded"
                                    placeholder="Enter reason for rejection..."
                                    value={response.comment}
                                    onChange={(event) => handleCommentChange(index, event)}
                                />
                                )}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={() => {
                            
                        }}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    >
                        Re-run coding
                    </button>
                </div>
            </div>
            <NavigationBottomBar previousPage={ROUTES.GENERATION} nextPage={ROUTES.FINAL}  isReady={isReadyCheck}/>
        </div>
    );
};

export default CodingValidationPage;