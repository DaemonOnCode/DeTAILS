import React, { useState } from 'react';

// --- Types ---
interface DataResponse {
    [subreddit: string]: {
        posts: {
            [year: string]: string[];
        };
        comments: {
            [year: string]: string[];
        };
    };
}

// Each array of strings now becomes an array of booleans.
type SelectedState = {
    [subreddit: string]: {
        posts: { [year: string]: boolean[] };
        comments: { [year: string]: boolean[] };
    };
};

const TorrentSelectionPanel: React.FC<{
    dataResource: { read(): DataResponse };
}> = ({ dataResource }) => {
    // This will suspend until the promise resolves.
    const dataResponse = dataResource.read();

    // Build initial selection state: for each subreddit, type, and year,
    // create an array of booleans (all false) matching the length of the data array.
    const [selected, setSelected] = useState<SelectedState>(() => {
        const initial: SelectedState = {};
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

    // Collapse/expand controls for subreddit, type, and year group levels.
    const [expandedSubreddits, setExpandedSubreddits] = useState<{ [key: string]: boolean }>({});
    const [expandedTypes, setExpandedTypes] = useState<{ [key: string]: boolean }>({});
    const [expandedYears, setExpandedYears] = useState<{ [key: string]: boolean }>({});

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

    // Toggle selection functions (unchanged from your implementation)
    const toggleSubredditSelection = (subreddit: string) => {
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

        const newSubreddit = {
            posts: {} as { [year: string]: boolean[] },
            comments: {} as { [year: string]: boolean[] }
        };
        Object.keys(dataResponse[subreddit].posts).forEach((year) => {
            newSubreddit.posts[year] = dataResponse[subreddit].posts[year].map(() => newValue);
        });
        Object.keys(dataResponse[subreddit].comments).forEach((year) => {
            newSubreddit.comments[year] = dataResponse[subreddit].comments[year].map(
                () => newValue
            );
        });

        setSelected((prev) => {
            const updated = { ...prev, [subreddit]: newSubreddit };
            if (newValue) {
                Object.keys(dataResponse).forEach((otherSubreddit) => {
                    if (otherSubreddit !== subreddit) {
                        updated[otherSubreddit] = { posts: {}, comments: {} };
                        Object.keys(dataResponse[otherSubreddit].posts).forEach((year) => {
                            updated[otherSubreddit].posts[year] = dataResponse[
                                otherSubreddit
                            ].posts[year].map(() => false);
                        });
                        Object.keys(dataResponse[otherSubreddit].comments).forEach((year) => {
                            updated[otherSubreddit].comments[year] = dataResponse[
                                otherSubreddit
                            ].comments[year].map(() => false);
                        });
                    }
                });
            }
            return updated;
        });
    };

    const toggleTypeSelection = (subreddit: string, type: 'posts' | 'comments') => {
        const current = selected[subreddit][type];
        const hasData = Object.keys(dataResponse[subreddit][type]).length > 0;
        const allSelected = hasData
            ? Object.values(current).every((arr) => arr.every(Boolean))
            : false;
        const newValue = !allSelected;
        const newTypeSelection: { [year: string]: boolean[] } = {};
        Object.keys(dataResponse[subreddit][type]).forEach((year) => {
            newTypeSelection[year] = dataResponse[subreddit][type][year].map(() => newValue);
        });
        setSelected((prev) => ({
            ...prev,
            [subreddit]: { ...prev[subreddit], [type]: newTypeSelection }
        }));
    };

    const toggleYearGroupSelection = (
        subreddit: string,
        type: 'posts' | 'comments',
        year: string
    ) => {
        const currentGroup = selected[subreddit][type][year];
        const allSelected = currentGroup.every(Boolean);
        const newValue = !allSelected;
        setSelected((prev) => ({
            ...prev,
            [subreddit]: {
                ...prev[subreddit],
                [type]: {
                    ...prev[subreddit][type],
                    [year]: currentGroup.map(() => newValue)
                }
            }
        }));
    };

    const toggleIndividualItemSelection = (
        subreddit: string,
        type: 'posts' | 'comments',
        year: string,
        index: number
    ) => {
        setSelected((prev) => {
            const newGroup = [...prev[subreddit][type][year]];
            newGroup[index] = !newGroup[index];
            return {
                ...prev,
                [subreddit]: {
                    ...prev[subreddit],
                    [type]: {
                        ...prev[subreddit][type],
                        [year]: newGroup
                    }
                }
            };
        });
    };

    return (
        // Outer container with sticky behavior applied to each subsection.
        <div className="flex flex-col flex-1 overflow-y-auto w-full">
            <h2 className="text-xl font-bold mb-4">Previously Downloaded Data</h2>
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
                    // Each subreddit container has a max-height and its own scroll.
                    <div
                        key={subreddit}
                        className="relative max-h-96 overflow-y-auto mb-4 rounded border w-full">
                        {/* Subreddit header is sticky */}
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
                                            {/* Type header is sticky within the subreddit container. 
                          Adjust the top offset (e.g. top-10) based on the height of the subreddit header */}
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
                                                                    {/* Year header sticky within the type container.
                                      Adjust top offset (e.g., top-20) to account for the subreddit and type headers */}
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
