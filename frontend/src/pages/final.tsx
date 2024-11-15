import { useEffect, useState } from "react";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES, exampleData } from "../constants/shared";
import { IRedditPost } from "../types/shared";
const { ipcRenderer } = window.require("electron");

const FinalPage = () => {
  const [isViewOpen, setIsViewOpen] = useState<boolean | null>(null);
  const [browserViewBounds, setBrowserViewBounds] = useState({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  });

  useEffect(() => {
    return () => {
      closeBrowserView();
      ipcRenderer.removeAllListeners("close-reddit-webview");
    };
  }, []);

  const openBrowserView = async (post: IRedditPost) => {
    console.log("Opening browser view for post:", post, post.link, post.sentence);
    const result = await ipcRenderer.invoke("render-reddit-webview", post.link, post.sentence);
    console.log(result);
    setBrowserViewBounds(result.bounds);
    setIsViewOpen(true);
  };

  const closeBrowserView = () => {
    ipcRenderer.invoke("close-reddit-webview");
    setIsViewOpen(false);
    setBrowserViewBounds({ x: 0, y: 0, width: 800, height: 600 });
  };

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
                      onClick={() => openBrowserView(item)}
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

      {/* Modal Overlay */}
      {isViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div
            className="relative bg-white rounded-lg shadow-lg p-8" // Increased padding
            style={{
              width: `${browserViewBounds.width + 120}px`, // Adjusted width to add padding for close button
              height: `${browserViewBounds.height + 120}px`, // Adjusted height to add padding for close button
            }}
          >
            <button
              onClick={closeBrowserView}
              className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-full"
            >
              X
            </button>
          </div>
        </div>
      )}

      <NavigationBottomBar previousPage={ROUTES.CODING_VALIDATION} />
    </div>
  );
};

export default FinalPage;
