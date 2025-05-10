import React, { RefObject, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';
import { useCollectionContext } from '../../context/collection-context';

interface DataResponse {
    [subreddit: string]: {
        posts: { [year: string]: string[] };
        comments: { [year: string]: string[] };
    };
}

const TorrentSelectionPanel: React.FC<{
    dataResource: { read(): DataResponse };
    selectedFilesRef: RefObject<any | null>;
}> = ({ dataResource, selectedFilesRef }) => {
    const dataResponse = dataResource.read();
    const { modeInput, setModeInput } = useCollectionContext();
    const [activeSubreddit, setActiveSubreddit] = useState<string | null>(null);
    const [selected, setSelected] = useState<TorrentFilesSelectedState>(() => {
        const initial: TorrentFilesSelectedState = {};
        Object.keys(dataResponse).forEach((subreddit) => {
            initial[subreddit] = { posts: {}, comments: {} };
            (['posts', 'comments'] as const).forEach((type) => {
                Object.keys(dataResponse[subreddit][type]).forEach((year) => {
                    initial[subreddit][type][year] = dataResponse[subreddit][type][year].map(
                        () => false
                    );
                });
            });
        });
        return initial;
    });
    const [expandedSubreddits, setExpandedSubreddits] = useState<{ [key: string]: boolean }>({});
    const [expandedTypes, setExpandedTypes] = useState<{ [key: string]: boolean }>({});
    const [expandedYears, setExpandedYears] = useState<{ [key: string]: boolean }>({});

    function sortAndFilterFileList(input: string, subreddit: string): string {
        const parts = input.split('|');
        if (parts.length < 4) return input;
        const fileList = parts.pop()!.split(',').filter(Boolean);
        const validFiles = fileList.filter((file) => {
            const [prefix, yearMonth] = file.split('_');
            const [year, month] = yearMonth.split('-');
            const type = prefix === 'RS' ? 'posts' : prefix === 'RC' ? 'comments' : null;
            return (
                type &&
                dataResponse[subreddit] &&
                dataResponse[subreddit][type][year]?.includes(month)
            );
        });
        validFiles.sort();
        const sortedFilteredFileList = validFiles.join(',');
        parts.push(sortedFilteredFileList);
        return parts.join('|');
    }

    const getFilesForSubreddit = (subreddit: string): string[] => {
        const fileList: string[] = [];
        const subredditSelection = selected[subreddit];
        if (!subredditSelection) return fileList;
        (['posts', 'comments'] as const).forEach((type) => {
            Object.keys(subredditSelection[type]).forEach((year) => {
                const selectedArray = subredditSelection[type][year];
                const filesArray = dataResponse[subreddit][type][year];
                selectedArray.forEach((isSelected, index) => {
                    if (isSelected && filesArray[index]) {
                        const prefix = type === 'posts' ? 'RS' : 'RC';
                        const month = filesArray[index];
                        fileList.push(`${prefix}_${year}-${month}`);
                    }
                });
            });
        });
        return fileList;
    };

    useEffect(() => {
        console.log(activeSubreddit, modeInput, 'toggling subreddit');
        if (!activeSubreddit) return;

        const files = getFilesForSubreddit(activeSubreddit);
        const hasFiles = files.length > 0;
        const base = `reddit|torrent|${activeSubreddit}`;
        const nextInput = hasFiles ? `${base}|files|${files.join(',')}` : `${base}|files|`;

        const sortedFilteredNextInput = sortAndFilterFileList(nextInput, activeSubreddit);
        const sortedFilteredModeInput = sortAndFilterFileList(modeInput, activeSubreddit);

        console.log(
            'sortedFilteredNextInput',
            sortedFilteredNextInput,
            'sortedFilteredModeInput',
            sortedFilteredModeInput
        );
        if (!modeInput.startsWith(base) || sortedFilteredNextInput !== sortedFilteredModeInput) {
            setModeInput(sortedFilteredNextInput);
        }
        // if (sortedFilteredNextInput !== sortedFilteredModeInput) {
        //     setModeInput(sortedFilteredNextInput);
        // }
    }, [selected, activeSubreddit, modeInput]);

    useEffect(() => {
        if (modeInput && modeInput.includes('|files|')) {
            const [base, filesStr] = modeInput.split('|files|');
            const parts = base.split('|');
            if (parts.length >= 3) {
                const subredditFromMode = parts[2];
                setActiveSubreddit(subredditFromMode);
                const filesList = filesStr.split(',').filter(Boolean);
                const updatedSelected = { ...selected };

                const validFiles = filesList.filter((fileEntry) => {
                    const [prefix, yearMonth] = fileEntry.split('_');
                    const [year, month] = yearMonth.split('-');
                    const type = prefix === 'RS' ? 'posts' : prefix === 'RC' ? 'comments' : null;
                    return (
                        type &&
                        dataResponse[subredditFromMode] &&
                        dataResponse[subredditFromMode][type][year]?.includes(month)
                    );
                });

                validFiles.forEach((fileEntry) => {
                    const [prefix, yearMonth] = fileEntry.split('_');
                    const [year, month] = yearMonth.split('-');
                    const type = prefix === 'RS' ? 'posts' : 'comments';
                    const monthArray = dataResponse[subredditFromMode][type][year];
                    const monthIndex = monthArray.findIndex((m) => m === month);
                    if (monthIndex !== -1) {
                        updatedSelected[subredditFromMode][type][year] = [
                            ...updatedSelected[subredditFromMode][type][year]
                        ];
                        updatedSelected[subredditFromMode][type][year][monthIndex] = true;
                    }
                });
                setSelected(updatedSelected);
            }
        }
    }, []);

    useImperativeHandle(
        selectedFilesRef,
        () => ({
            getFiles: () => {
                const result: Array<[string, string[]]> = [];
                Object.keys(selected).forEach((subreddit) => {
                    const fileList = getFilesForSubreddit(subreddit);
                    if (fileList.length > 0) {
                        result.push([subreddit, fileList]);
                    }
                });
                return result;
            }
        }),
        [selected, dataResponse]
    );

    const resetOtherSubreddits = (
        currentSubreddit: string,
        state: TorrentFilesSelectedState
    ): TorrentFilesSelectedState => {
        const newState = { ...state };
        Object.keys(dataResponse).forEach((otherSubreddit) => {
            if (otherSubreddit !== currentSubreddit) {
                newState[otherSubreddit] = { posts: {}, comments: {} };
                Object.keys(dataResponse[otherSubreddit].posts).forEach((year) => {
                    newState[otherSubreddit].posts[year] = dataResponse[otherSubreddit].posts[
                        year
                    ].map(() => false);
                });
                Object.keys(dataResponse[otherSubreddit].comments).forEach((year) => {
                    newState[otherSubreddit].comments[year] = dataResponse[otherSubreddit].comments[
                        year
                    ].map(() => false);
                });
            }
        });
        return newState;
    };

    const toggleSubredditExpand = (subreddit: string) => {
        setExpandedSubreddits((prev) => ({ ...prev, [subreddit]: !prev[subreddit] }));
    };

    const toggleTypeExpand = (subreddit: string, type: 'posts' | 'comments') => {
        const key = `${subreddit}-${type}`;
        setExpandedTypes((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleYearExpand = (subreddit: string, type: 'posts' | 'comments', year: string) => {
        const key = `${subreddit}-${type}-${year}`;
        setExpandedYears((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleSubredditSelection = useCallback(
        (subreddit: string) => {
            console.log('toggling subreddit selection', subreddit);
            const current = selected[subreddit];
            const postsAvailable = Object.keys(dataResponse[subreddit].posts).length > 0;
            const commentsAvailable = Object.keys(dataResponse[subreddit].comments).length > 0;
            const postsAllSelected = postsAvailable
                ? Object.values(current.posts).every((arr) => arr.every(Boolean))
                : true;
            const commentsAllSelected = commentsAvailable
                ? Object.values(current.comments).every((arr) => arr.every(Boolean))
                : true;
            const newValue = !(postsAllSelected && commentsAllSelected);

            setSelected((prev) => {
                const updated = { ...prev };
                const newSubreddit = {
                    posts: {} as { [year: string]: boolean[] },
                    comments: {} as { [year: string]: boolean[] }
                };
                Object.keys(dataResponse[subreddit].posts).forEach((year) => {
                    newSubreddit.posts[year] = dataResponse[subreddit].posts[year].map(
                        () => newValue
                    );
                });
                Object.keys(dataResponse[subreddit].comments).forEach((year) => {
                    newSubreddit.comments[year] = dataResponse[subreddit].comments[year].map(
                        () => newValue
                    );
                });
                updated[subreddit] = newSubreddit;
                if (newValue && activeSubreddit !== subreddit) {
                    console.log('resetting other subreddits');
                    const resetState = resetOtherSubreddits(subreddit, updated);
                    setActiveSubreddit(subreddit);
                    return resetState;
                }
                return updated;
            });
        },
        [selected, activeSubreddit]
    );

    const toggleTypeSelection = (subreddit: string, type: 'posts' | 'comments') => {
        const current = selected[subreddit][type];
        const hasData = Object.keys(dataResponse[subreddit][type]).length > 0;
        const allSelected = hasData
            ? Object.values(current).every((arr) => arr.every(Boolean))
            : false;
        const newValue = !allSelected;
        setSelected((prev) => {
            const updated = { ...prev };
            const newTypeSelection: { [year: string]: boolean[] } = {};
            Object.keys(dataResponse[subreddit][type]).forEach((year) => {
                newTypeSelection[year] = dataResponse[subreddit][type][year].map(() => newValue);
            });
            updated[subreddit] = { ...prev[subreddit], [type]: newTypeSelection };
            if (newValue && activeSubreddit !== subreddit) {
                const resetState = resetOtherSubreddits(subreddit, updated);
                setActiveSubreddit(subreddit);
                return resetState;
            }
            return updated;
        });
    };

    const toggleYearGroupSelection = (
        subreddit: string,
        type: 'posts' | 'comments',
        year: string
    ) => {
        const currentGroup = selected[subreddit][type][year];
        const allSelected = currentGroup.every(Boolean);
        const newValue = !allSelected;
        setSelected((prev) => {
            const updated = { ...prev };
            updated[subreddit] = {
                ...prev[subreddit],
                [type]: {
                    ...prev[subreddit][type],
                    [year]: currentGroup.map(() => newValue)
                }
            };
            if (newValue && activeSubreddit !== subreddit) {
                const resetState = resetOtherSubreddits(subreddit, updated);
                setActiveSubreddit(subreddit);
                return resetState;
            }
            return updated;
        });
    };

    const toggleIndividualItemSelection = (
        subreddit: string,
        type: 'posts' | 'comments',
        year: string,
        index: number
    ) => {
        setSelected((prev) => {
            const updated = { ...prev };
            const newGroup = [...prev[subreddit][type][year]];
            const toggledValue = !newGroup[index];
            newGroup[index] = toggledValue;
            updated[subreddit] = {
                ...prev[subreddit],
                [type]: {
                    ...prev[subreddit][type],
                    [year]: newGroup
                }
            };
            if (toggledValue && activeSubreddit !== subreddit) {
                const resetState = resetOtherSubreddits(subreddit, updated);
                setActiveSubreddit(subreddit);
                return resetState;
            }
            return updated;
        });
    };

    return (
        <div className="flex flex-col flex-1 overflow-y-auto w-full">
            <h2 className="text-xl font-bold mb-4">Previously Downloaded Data</h2>
            {Object.keys(dataResponse).length === 0 && (
                <div className="text-sm text-gray-500 py-2">No data available</div>
            )}
            {Object.keys(dataResponse).map((subreddit) => {
                const postsAvailable = Object.keys(dataResponse[subreddit].posts).length > 0;
                const commentsAvailable = Object.keys(dataResponse[subreddit].comments).length > 0;
                const mainDisabled = !postsAvailable && !commentsAvailable;
                const postsAllChecked = postsAvailable
                    ? Object.values(selected[subreddit].posts).every((arr) => arr.every(Boolean))
                    : true;
                const commentsAllChecked = commentsAvailable
                    ? Object.values(selected[subreddit].comments).every((arr) => arr.every(Boolean))
                    : true;
                const mainChecked = !mainDisabled && postsAllChecked && commentsAllChecked;

                return (
                    <div
                        key={subreddit}
                        className={`relative max-h-96 overflow-y-auto mb-4 rounded border w-full ${activeSubreddit === subreddit && 'border-blue-500 border-2'}`}>
                        <div
                            className="sticky top-0 bg-gray-300 z-30 flex flex-wrap items-center justify-between p-2 cursor-pointer"
                            onClick={() => toggleSubredditSelection(subreddit)}>
                            <div className="flex items-center flex-1 min-w-0">
                                <input
                                    type="checkbox"
                                    readOnly
                                    disabled={mainDisabled}
                                    checked={mainChecked}
                                    className="mr-2"
                                />
                                <span className="font-semibold truncate">{subreddit}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubredditExpand(subreddit);
                                }}
                                className="text-sm text-blue-500">
                                {expandedSubreddits[subreddit] ? 'Collapse' : 'Expand'}
                            </button>
                        </div>
                        {expandedSubreddits[subreddit] && (
                            <div className="w-full">
                                {(['posts', 'comments'] as const).map((type) => {
                                    const typeAvailable =
                                        Object.keys(dataResponse[subreddit][type]).length > 0;
                                    const typeChecked = typeAvailable
                                        ? Object.values(selected[subreddit][type]).every((arr) =>
                                              arr.every(Boolean)
                                          )
                                        : false;
                                    return (
                                        <div key={type} className="relative w-full border-b">
                                            <div
                                                className="sticky top-10 bg-gray-200 z-20 flex flex-wrap items-center justify-between cursor-pointer p-2"
                                                onClick={() =>
                                                    toggleTypeSelection(subreddit, type)
                                                }>
                                                <div className="flex items-center flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        readOnly
                                                        disabled={!typeAvailable}
                                                        checked={
                                                            typeAvailable ? typeChecked : false
                                                        }
                                                        className="mr-2"
                                                    />
                                                    <span className="font-medium capitalize truncate">
                                                        {type}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleTypeExpand(subreddit, type);
                                                    }}
                                                    className="text-sm text-blue-500">
                                                    {expandedTypes[`${subreddit}-${type}`]
                                                        ? 'Collapse'
                                                        : 'Expand'}
                                                </button>
                                            </div>
                                            {expandedTypes[`${subreddit}-${type}`] && (
                                                <div className="w-full">
                                                    {Object.keys(dataResponse[subreddit][type])
                                                        .length ? (
                                                        Object.keys(
                                                            dataResponse[subreddit][type]
                                                        ).map((year) => {
                                                            const group =
                                                                dataResponse[subreddit][type][year];
                                                            const groupSelected =
                                                                selected[subreddit][type][year];
                                                            const groupAllChecked =
                                                                groupSelected.every(Boolean);
                                                            return (
                                                                <div
                                                                    key={year}
                                                                    className="relative w-full">
                                                                    <div
                                                                        className="sticky top-20 bg-gray-100 z-10 flex flex-wrap items-center justify-between cursor-pointer p-2"
                                                                        onClick={() =>
                                                                            toggleYearGroupSelection(
                                                                                subreddit,
                                                                                type,
                                                                                year
                                                                            )
                                                                        }>
                                                                        <div className="flex items-center flex-1 min-w-0">
                                                                            <input
                                                                                type="checkbox"
                                                                                readOnly
                                                                                checked={
                                                                                    groupAllChecked
                                                                                }
                                                                                className="mr-2"
                                                                            />
                                                                            <span className="font-medium truncate">
                                                                                {year}
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleYearExpand(
                                                                                    subreddit,
                                                                                    type,
                                                                                    year
                                                                                );
                                                                            }}
                                                                            className="text-sm text-blue-500">
                                                                            {expandedYears[
                                                                                `${subreddit}-${type}-${year}`
                                                                            ]
                                                                                ? 'Collapse'
                                                                                : 'Expand'}
                                                                        </button>
                                                                    </div>
                                                                    {expandedYears[
                                                                        `${subreddit}-${type}-${year}`
                                                                    ] && (
                                                                        <div className="pl-4 mt-1">
                                                                            {group.map(
                                                                                (item, index) => (
                                                                                    <div
                                                                                        key={index}
                                                                                        className="flex items-center cursor-pointer"
                                                                                        onClick={() =>
                                                                                            toggleIndividualItemSelection(
                                                                                                subreddit,
                                                                                                type,
                                                                                                year,
                                                                                                index
                                                                                            )
                                                                                        }>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            readOnly
                                                                                            checked={
                                                                                                selected[
                                                                                                    subreddit
                                                                                                ][
                                                                                                    type
                                                                                                ][
                                                                                                    year
                                                                                                ][
                                                                                                    index
                                                                                                ]
                                                                                            }
                                                                                            className="mr-2"
                                                                                        />
                                                                                        <span className="truncate">
                                                                                            {item}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="ml-4 text-sm text-gray-500 p-2">
                                                            No {type} available
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default TorrentSelectionPanel;
