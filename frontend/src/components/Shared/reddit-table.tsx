import { FC, useState } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import RedditViewModal from '../Coding/Shared/reddit-view-modal';
import { RedditTableProps } from '../../types/Coding/props';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';

const RedditTable: FC<RedditTableProps> = ({
    data,
    selectedPosts,
    togglePostSelection,
    toggleSelectPage,
    isLoading
}) => {
    const { isLocked } = useCollectionContext();
    const [selectedPost, setSelectedPost] = useState<(typeof data)[number] | null>(null);

    // Check if all posts on the current page are selected
    const areAllPagePostsSelected = data.every(([id]) => selectedPosts.includes(id));

    return (
        <div className="overflow-x-auto h-full w-full relative">
            <table className="table-auto w-full border border-gray-300">
                <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="px-4 py-4 border">
                            {/* Disable the "select all" checkbox if locked */}
                            {!isLoading && (
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelectPage(data);
                                    }}
                                    checked={areAllPagePostsSelected}
                                    disabled={isLocked}
                                />
                            )}
                        </th>
                        <th className="px-4 py-4 border">URL</th>
                        <th className="px-4 py-4 border">Created UTC</th>
                        <th className="px-4 py-4 border">Title</th>
                        <th className="px-4 py-4 border">Text</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading
                        ? // Render skeleton rows if loading
                          [...Array(10)].map((_, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse"></div>
                                  </td>
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-full bg-gray-200 rounded animate-pulse"></div>
                                  </td>
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-full bg-gray-200 rounded animate-pulse"></div>
                                  </td>
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-full bg-gray-200 rounded animate-pulse"></div>
                                  </td>
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-full bg-gray-200 rounded animate-pulse"></div>
                                  </td>
                              </tr>
                          ))
                        : // Render actual data rows when not loading
                          data.map((post, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-6 border">
                                      <input
                                          id={`reddit-post-checkbox-${index}`}
                                          type="checkbox"
                                          checked={selectedPosts.includes(post[0])}
                                          onChange={() => togglePostSelection(post[0])}
                                          disabled={isLocked} // <-- Disable if isLocked
                                      />
                                  </td>
                                  <td className="px-4 py-6 border">
                                      <p
                                          className="text-blue-500 underline cursor-pointer"
                                          onClick={() => setSelectedPost(post)}>
                                          {post[0]}
                                      </p>
                                  </td>
                                  <td className="px-4 py-6 border">
                                      {new Date(post[1].created_utc * 1000).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-6 border">{post[1].title}</td>
                                  <td className="px-4 py-6 border">{post[1].selftext}</td>
                              </tr>
                          ))}
                </tbody>
            </table>
            {data.length === 0 && (
                <p className="text-center w-full mt-8">
                    Data not found, recheck subreddit details
                    <br />
                    <Link
                        to={`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                        className="underline text-blue-500">
                        Load data again
                    </Link>
                </p>
            )}
            {selectedPost && (
                <RedditViewModal
                    isViewOpen={selectedPost !== null}
                    postLink={selectedPost[1].url || selectedPost[1].permalink}
                    postText={selectedPost[1].selftext}
                    closeModal={() => setSelectedPost(null)}
                    postId={selectedPost[0]}
                />
            )}
        </div>
    );
};

export default RedditTable;
