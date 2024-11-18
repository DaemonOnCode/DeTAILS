import { useState } from 'react';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';
import { ROUTES, exampleData } from '../constants/shared';
import { IRedditPost } from '../types/shared';
import RedditViewModal from '../components/Shared/reddit_view_modal';

const FinalPage = () => {
    const [renderedPost, setRenderedPost] = useState<IRedditPost>();

    return (
        <div className="p-6 h-full flex justify-between flex-col">
            <div>
                <h2 className="text-xl font-bold mb-4">Final Page</h2>
                <p className="mb-6">
                    Below is the data extracted from Reddit posts with related words and contexts:
                </p>

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
                                            onClick={() => {
                                                setRenderedPost(item);
                                            }}
                                            className="text-blue-500 underline">
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

            {renderedPost !== undefined && (
                <RedditViewModal
                    isViewOpen={renderedPost !== undefined}
                    postLink={renderedPost!.link}
                    postText={renderedPost?.sentence}
                    closeModal={() => {
                        console.log('Closing modal');
                        setRenderedPost(undefined);
                    }}
                />
            )}

            <NavigationBottomBar previousPage={ROUTES.CODING_VALIDATION} />
        </div>
    );
};

export default FinalPage;
