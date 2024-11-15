import { useEffect, useState } from "react";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES } from "../constants/shared";
import { IRedditPost } from "../types/shared";
const { ipcRenderer } = window.require('electron');

const exampleData: IRedditPost[] = [
  {
    sentence: "The new JavaScript framework is incredible for web development.",
    word: "JavaScript",
    link: "https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/bird_flu_begins_its_human_spread_as_health/",
    reason: "Highly discussed technology in web development.",
    context: "JavaScript is a core language for building interactive web applications.",
  },
  {
    sentence: "Python has been widely used for data analysis and machine learning.",
    word: "Python",
    link: "https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/comment/lwciyij/",
    reason: "Popular for its ease of use and libraries for AI.",
    context: "Reddit posts highlight Python's dominance in AI-related tasks.",
  },
  {
    sentence: "React is a favorite among developers for building modern web apps.",
    word: "React",
    link: "https://www.reddit.com/r/HermanCainAward/comments/1gnh2e1/bird_flu_begins_its_human_spread_as_health/",
    reason: "Frequently chosen for component-based web architecture.",
    context: "Posts often emphasize React's role in frontend frameworks.",
  },
];

const FinalPage = () => {
  const [selectedPost, setSelectedPost] = useState<IRedditPost | null>(null);
  const [screenshot, setScreenshot] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = async (post: IRedditPost) => {
    // setSelectedPost(post);
    // setModalOpen(true);
    const response = await ipcRenderer.invoke("capture-reddit-screenshot", post.link); // Ask main process to open the modal
    console.log(response);
    if (response.success) {
      let b64encoded = Buffer.from(response.buffer).toString("base64");
      setScreenshot(`data:image/png;base64,${b64encoded}`);
      setModalOpen(true);
    } else {
      console.error(response.error);
      // setError(response.error || "Failed to capture screenshot.");
    }
  };

  const closeModal = async() => {
    // setSelectedPost(null);
    // await ipcRenderer.invoke("close-puppeteer-window");
    setModalOpen(false);
  };

//   useEffect(() => {
//     if (selectedPost) {
//       // Open the Reddit post modal
//       console.log("Opening Reddit post modal:", selectedPost);
//       openModal(selectedPost);
//     }
//   } , [selectedPost]);

  return (
    <div className="p-6 h-full flex justify-between flex-col">
      <div>
        <h2 className="text-xl font-bold mb-4">Final Page</h2>
        <p className="mb-6">Below is the data extracted from Reddit posts with related words and contexts:</p>

        {/* Table Container */}
        <div className="overflow-auto max-h-[70vh] border border-gray-300 rounded-lg">
          <table className="w-full border-collapse">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-400 p-2">Sentence</th>
                <th className="border border-gray-400 p-2">Word</th>
                <th className="border border-gray-400 p-2">Link</th>
                <th className="border border-gray-400 p-2">Reason</th>
                <th className="border border-gray-400 p-2">Context</th>
              </tr>
            </thead>
            <tbody>
              {exampleData.map((item, index) => (
                <tr key={index} className="text-center">
                  <td className="border border-gray-400 p-2">{item.sentence}</td>
                  <td className="border border-gray-400 p-2">{item.word}</td>
                  <td className="border border-gray-400 p-2">
                    <button
                      onClick={() => openModal(item)}
                      className="text-blue-500 underline"
                    >
                      View Post
                    </button>
                  </td>
                  <td className="border border-gray-400 p-2">{item.reason}</td>
                  <td className="border border-gray-400 p-2">{item.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
                
        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="relative bg-white p-4 rounded-lg max-w-[90%] max-h-[90%] overflow-auto">
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-lg font-bold text-red-500"
              >
                X
              </button>
              <img src={screenshot} alt="Reddit Post" className="p-4" />
            </div>
          </div>
        )}
      <NavigationBottomBar previousPage={ROUTES.CODING_VALIDATION} />
    </div>
  );
};

export default FinalPage;
