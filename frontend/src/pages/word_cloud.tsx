import { FC, useContext, useState } from "react";
import { ROUTES, WORD_CLOUD_MIN_THRESHOLD, newWordsPool } from "../constants/shared";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import WordCloud from "../components/WordCloud/index";
import { DataContext } from "../context/data_context";

const WordCloudPage: FC = () => {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const dataContext = useContext(DataContext);

  const toggleWordSelection = (word: string) => {
    if (word === dataContext.mainWord) return;

    dataContext.setSelectedWords((prevSelected) =>
      prevSelected.includes(word) ? prevSelected.filter((w) => w !== word) : [...prevSelected, word]
    );
  };

  const handleFeedbackChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFeedback(event.target.value);
  };

  const submitFeedback = () => {
    console.log("User feedback:", feedback);
    setFeedback("");  // Clear feedback input
    setIsFeedbackOpen(false);  // Close the modal

    refreshWordCloud(); 
  };

  const refreshWordCloud = () => {
    const newSelectedWords = dataContext.words.filter((word) => dataContext.selectedWords.includes(word));
  
    const additionalWords = newWordsPool.filter(
      (word) => !dataContext.selectedWords.includes(word) && !newSelectedWords.includes(word)
    ).slice(0, 20 - newSelectedWords.length);

    dataContext.setWords([...newSelectedWords, ...additionalWords]);
    dataContext.setSelectedWords([...newSelectedWords]);
  };

  const refreshWords = () => {
    // Open the feedback modal
    setIsFeedbackOpen(true);
  };

  const checkIfReady = dataContext.selectedWords.length > WORD_CLOUD_MIN_THRESHOLD;

  return (
    <div className="p-6 h-full flex justify-between flex-col">
      <div className="flex justify-center items-center flex-col">
        <div className="my-10 text-center">
          <h1 className="text-2xl font-bold mb-4">Word Cloud</h1>
          <p>Select all of the words which you feel are similar to the main word</p>
          <button
            onClick={refreshWords}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 mt-10 mb-5"
          >
            Refresh word cloud
          </button>
        </div>
        
        <WordCloud
          mainWord={dataContext.mainWord}
          words={dataContext.words}
          selectedWords={dataContext.selectedWords}
          toggleWordSelection={toggleWordSelection}
        />
      </div>
      
      <NavigationBottomBar previousPage={ROUTES.BASIS} nextPage={ROUTES.GENERATION} isReady={checkIfReady} />

      {isFeedbackOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Why are these words unsatisfactory?</h2>
            <p className=" mb-3">Word list: {dataContext.words.filter((word) => !dataContext.selectedWords.includes(word)).join(", ")}</p>
            <textarea
              value={feedback}
              onChange={handleFeedbackChange}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Enter your feedback here..."
            ></textarea>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="mr-4 bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCloudPage;
