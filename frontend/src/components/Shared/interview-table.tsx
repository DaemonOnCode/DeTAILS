import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';
import InterviewViewModal from './interview-modal';
import { ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

export interface InterviewTableProps {
    data: any[];
    selectedFiles: string[];
    toggleFileSelection: (id: string) => void;
    toggleSelectPage: (filesOnPage: any[]) => void;
    isLoading: boolean;
    itemsPerPage?: number;
}

const InterviewTable: FC<InterviewTableProps> = ({
    data,
    selectedFiles,
    toggleFileSelection,
    toggleSelectPage,
    isLoading,
    itemsPerPage = 10
}) => {
    const { isLocked } = useCollectionContext();
    const [viewingFile, setViewingFile] = useState<any | null>(null);

    const allThisPageSelected =
        data.length > 0 && data.every((file) => selectedFiles.includes(file.id));

    const parseMeta = (raw: any) => {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    };

    return (
        <div className="overflow-x-auto h-full w-full relative">
            <table className="table-auto w-full border border-gray-300">
                <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="px-4 py-4 border">
                            {!isLoading && (
                                <input
                                    type="checkbox"
                                    onChange={() => toggleSelectPage(data)}
                                    checked={allThisPageSelected}
                                    disabled={isLocked}
                                    className="h-4 w-4 cursor-pointer"
                                />
                            )}
                        </th>
                        <th className="px-4 py-4 border">File ID</th>
                        <th className="px-4 py-4 border">Title</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading
                        ? Array.from({ length: itemsPerPage }).map((_, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-6 border">
                                      <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse" />
                                  </td>
                                  {Array(2)
                                      .fill(0)
                                      .map((_, j) => (
                                          <td key={j} className="px-4 py-6 border">
                                              <div className="h-6 w-full bg-gray-200 rounded animate-pulse" />
                                          </td>
                                      ))}
                              </tr>
                          ))
                        : data.map((file, idx) => {
                              const meta = parseMeta(file.metadata);
                              return (
                                  <tr key={file.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-6 border text-center">
                                          <input
                                              id={`interview-file-checkbox-${idx}`}
                                              type="checkbox"
                                              checked={selectedFiles.includes(file.id)}
                                              onChange={() => toggleFileSelection(file.id)}
                                              disabled={isLocked}
                                              className="h-4 w-4"
                                          />
                                      </td>
                                      <td className="px-4 py-6 border">
                                          <p
                                              className="text-blue-500 underline cursor-pointer"
                                              onClick={() => setViewingFile(file)}>
                                              {file.id}
                                          </p>
                                      </td>
                                      <td className="px-4 py-6 border">
                                          {meta.title ?? <span className="text-gray-500">—</span>}
                                      </td>
                                  </tr>
                              );
                          })}
                </tbody>
            </table>

            {data.length === 0 && !isLoading && (
                <p className="text-center w-full mt-8">
                    No interview files found.
                    <br />
                    <Link
                        to={`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                        className="underline text-blue-500">
                        Upload interview data
                    </Link>
                </p>
            )}

            {viewingFile && (
                <InterviewViewModal
                    fileId={viewingFile.id}
                    isOpen={!!viewingFile}
                    closeModal={() => setViewingFile(null)}
                />
            )}
        </div>
    );
};

export default InterviewTable;
