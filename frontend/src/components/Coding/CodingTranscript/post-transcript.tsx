import { FC, useState, useMemo, useEffect, useCallback, useRef, useImperativeHandle } from 'react';
import { useTranscriptContext } from '../../../context/transcript-context';
import { IReference } from '../../../types/Coding/shared';
import RedditComments from './reddit-comments';
import HighlightedSegment from './highlighted-segment';
import RelatedCodes from './related-codes';
import AddCodeModal from '../Shared/add-code-modal';
import HighlightModal from '../Shared/highlight-modal';
import { PostTranscriptProps } from '../../../types/Coding/props';
import EditCodeModal from '../Shared/edit-code-modal';
import DeleteCodeModal from '../Shared/delete-code-modal';
import EditHighlightModal from '../Shared/edit-highlight-modal';
import DeleteHighlightModal from '../Shared/delete-highlight-modal';
import SwitchModal from './switch-modal';
import lodash from 'lodash';
import { useUndo } from '../../../hooks/Shared/use-undo';

const PostTranscript: FC<PostTranscriptProps> = ({
    post,
    onBack,
    review,
    _selectionRef,
    isActive = false,
    codeResponses,
    extraCodes = [],
    dispatchCodeResponse,
    conflictingCodes,
    handleSwitchToEditMode,
    isAddCodeModalOpen,
    setIsAddCodeModalOpen,
    isEditCodeModalOpen,
    setIsEditCodeModalOpen,
    isDeleteCodeModalOpen,
    setIsDeleteCodeModalOpen,
    isHighlightModalOpen,
    setIsHighlightModalOpen,
    isEditHighlightModalOpen,
    setIsEditHighlightModalOpen,
    isDeleteHighlightModalOpen,
    setDeleteIsHighlightModalOpen,
    clearedToLeaveRef,
    showBackButton = true
}) => {
    const {
        selectedText,
        setSelectedText,
        hoveredCode,
        setHoveredCodeText,
        additionalCodes,
        setAdditionalCodes,
        handleTextSelection,
        restoreSelection,
        removeSelection,
        containerRef,
        processTranscript,
        selectedSegment,
        setSelectedSegment,
        handleSegmentLeave,
        chatHistories,
        switchModalOn,
        setSwitchModalOn,
        selectedTextMarker
    } = useTranscriptContext();

    const { performWithUndo, performWithUndoForReducer, batch } = useUndo();

    const { processedSegments, codeSet, codeColors } = useMemo(
        () => processTranscript(post, extraCodes, codeResponses),
        [post, extraCodes, codeResponses]
    );

    console.log('Processed Segments:', processedSegments, codeSet, codeResponses);
    useEffect(() => {
        if (!codeSet.every((code, i) => code === additionalCodes[i])) {
            setAdditionalCodes(codeSet);
        }
    }, [codeSet]);

    const [selectedCode, setSelectedCode] = useState<string>('');
    const [reasoning, setReasoning] = useState<string>('');

    const [addHighlightModalHidden, setAddHighlightModalHidden] = useState(false);

    const currentReferences = useMemo(() => {
        console.log('remaking Current References:', codeSet, codeResponses, post.id);
        return Object.fromEntries(
            codeSet.map((code) => [
                code,
                codeResponses
                    .filter((response) => response.code === code && response.postId === post.id)
                    .map((response) => ({
                        text: response.quote,
                        isComment: true,
                        postId: response.postId
                    }))
            ])
        );
    }, [codeSet, codeResponses]);

    console.log('Current References:', currentReferences, codeResponses);

    const [references, setReferences] = useState<Record<string, IReference[]>>(currentReferences);

    useEffect(() => {
        console.log('Current config:', currentReferences, references);
        if (JSON.stringify(currentReferences) !== JSON.stringify(references)) {
            setReferences(currentReferences);
        }
    }, [currentReferences, references]);

    const setCodes = (value: any, type: string) => {
        if (!isActive) return;
        let result: string[] = [];
        if (typeof value !== 'function') {
            result = value;
        } else {
            console.log('Setting codes:', value);
            result = value(codeSet);
        }
        console.log('Result:', result);
        switch (type) {
            case 'ADD_CODE':
                console.log('Adding code:', result);
                performWithUndo([additionalCodes], [setAdditionalCodes], () => {
                    setAdditionalCodes([...result]);
                });
                break;
            case 'UPDATE_CODE_NAME': {
                batch(() => {
                    let newCode = result.find((code) => !codeSet.includes(code));
                    performWithUndoForReducer(codeResponses, dispatchCodeResponse, {
                        type: 'EDIT_CODE',
                        currentCode: selectedCode,
                        newCode
                    });
                    if (newCode) {
                        performWithUndo([additionalCodes], [setAdditionalCodes], () => {
                            setAdditionalCodes((prevCodes) =>
                                prevCodes.map((code) =>
                                    code === selectedCode ? (newCode ?? '') : code
                                )
                            );
                        });
                    }
                });
                break;
            }
            case 'DELETE_CODE':
                batch(() => {
                    performWithUndoForReducer(codeResponses, dispatchCodeResponse, {
                        type: 'DELETE_CODE',
                        code: selectedCode
                    });
                    performWithUndo([additionalCodes], [setAdditionalCodes], () => {
                        setAdditionalCodes((prevCodes) =>
                            prevCodes.filter((code) => code !== selectedCode)
                        );
                    });
                });
                break;
            default:
                break;
        }
        setSelectedCode('null');
    };

    function findSingleKeyDifference(
        oldReferences: Record<string, IReference[]>,
        newReferences: Record<string, IReference[]>,
        type: 'removed' | 'modified'
    ): {
        code: string;
        result: IReference;
        originalReference?: IReference;
    } | null {
        for (const key in oldReferences) {
            const oldArray = oldReferences[key] || [];
            const newArray = newReferences[key] || [];
            let result: IReference | undefined = undefined;
            let originalReference: IReference | undefined = undefined;
            if (type === 'removed') {
                result = oldArray.filter(
                    (oldItem) => !newArray.some((newItem) => newItem.text === oldItem.text)
                )?.[0];
            } else if (type === 'modified') {
                for (const newItem of newArray) {
                    const matchingOldItem = oldArray.find(
                        (oldItem) => oldItem.text !== newItem.text && oldItem.text === newItem.text
                    );
                    if (matchingOldItem) {
                        result = newItem;
                        originalReference = matchingOldItem;
                        break;
                    }
                }
            }
            if (result) {
                return {
                    code: key,
                    result,
                    originalReference
                };
            }
        }
        return null;
    }

    const applyCodeToSelection = (type: string, extra?: any) => {
        if (!isActive) return;
        console.log('Applying code to selection:', selectedText, selectedCode, type);
        if (!selectedText && isHighlightModalOpen) {
            alert(
                'Please select text. Make sure you explicitly select the text in an active tab, which can be distinguished by a blue border.'
            );
            return;
        }
        if (!selectedCode && isHighlightModalOpen) {
            alert('Please select a code.');
            return;
        }
        let difference: {
            code: string;
            result: IReference;
            originalReference?: IReference;
        } | null = null;
        switch (type) {
            case 'ADD_HIGHLIGHT':
                batch(() => {
                    performWithUndoForReducer(codeResponses, dispatchCodeResponse, {
                        type: 'ADD_RESPONSE',
                        response: {
                            id: Math.random().toString(36),
                            postId: post.id,
                            code: selectedCode,
                            quote: selectedText,
                            explanation: reasoning,
                            isMarked: true,
                            comment: '',
                            theme: '',
                            rangeMarker: selectedTextMarker
                        }
                    });
                    performWithUndo(
                        [selectedCode, reasoning],
                        [setSelectedCode, setReasoning],
                        () => {
                            setSelectedCode('null');
                            setReasoning('');
                        }
                    );
                });
                break;
            case 'EDIT_HIGHLIGHT':
                batch(() => {
                    console.log('Edit Difference:', difference, extra);
                    performWithUndoForReducer(codeResponses, dispatchCodeResponse, {
                        type: 'EDIT_HIGHLIGHT',
                        postId: post.id,
                        sentence: extra?.reference.text,
                        code: extra?.code,
                        newSentence: extra?.newText,
                        rangeMarker: selectedTextMarker
                    });
                });
                break;
            case 'DELETE_HIGHLIGHT':
                difference = findSingleKeyDifference(currentReferences, references, 'removed');
                console.log('Delete Difference:', difference, extra);
                batch(() => {
                    performWithUndoForReducer(codeResponses, dispatchCodeResponse, {
                        type: 'DELETE_HIGHLIGHT',
                        postId: post.id,
                        sentence: extra?.reference.text,
                        code: extra?.code
                    });
                });
                break;
            default:
                break;
        }
        setSelectedText(null);
        setIsHighlightModalOpen(false);
    };

    const allChatsResolved = Object.values(chatHistories).every((chat) =>
        chat[chat.length - 1].isEditable && chat[chat.length - 1].sender === 'Human'
            ? chat[chat.length - 2].reaction
            : chat[chat.length - 1].reaction
    );

    console.log('All Chats Resolved:', allChatsResolved, chatHistories);

    const handleBackClick = () => {
        if (!allChatsResolved) return;
        onBack();
    };

    const transcriptHandleMouseUp = useCallback(
        lodash.throttle(() => {
            handleTextSelection(_selectionRef);
        }, 100),
        [handleTextSelection, _selectionRef]
    );

    const transcriptHandleMouseClick = useCallback(() => {
        handleSegmentLeave(false);
        setSelectedSegment(null);
    }, []);

    useImperativeHandle(clearedToLeaveRef, () => {
        return {
            check: allChatsResolved
        };
    }, [allChatsResolved]);

    return !post ? (
        <p>Post not found</p>
    ) : (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-1 overflow-hidden m-6">
                <div className="flex-1 flex flex-col overflow-hidden">
                    {showBackButton && (
                        <button
                            id="transcript-back-button"
                            title={
                                allChatsResolved
                                    ? 'Go back to previous page'
                                    : 'Please resolve all chats'
                            }
                            onClick={handleBackClick}
                            disabled={!allChatsResolved}
                            className={`mb-4 ${allChatsResolved ? 'text-blue-500' : 'text-gray-500'} self-start`}>
                            ← <span className="underline">Back to Posts</span>
                        </button>
                    )}
                    <div
                        id="transcript-container"
                        className={`flex-1 overflow-auto ${isEditHighlightModalOpen ? 'cursor-pencil' : ''}`}
                        onMouseUp={transcriptHandleMouseUp}
                        onClick={transcriptHandleMouseClick}
                        ref={containerRef}>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold mb-2 relative">
                                {processedSegments
                                    .filter(
                                        (segment) =>
                                            segment.id === post.id && segment.type === 'title'
                                    )
                                    .map((segment, index) => (
                                        <HighlightedSegment key={index} segment={segment} />
                                    ))}
                            </h2>
                            <p className="text-gray-700 leading-relaxed relative">
                                {processedSegments
                                    .filter(
                                        (segment) =>
                                            segment.id === post.id && segment.type === 'selftext'
                                    )
                                    .map((segment, index) => (
                                        <HighlightedSegment key={index} segment={segment} />
                                    ))}
                            </p>
                        </div>
                        <h2 className="text-lg font-semibold mb-2">Comments</h2>
                        <div className="max-h-full">
                            <RedditComments
                                comments={post.comments}
                                hoveredCode={hoveredCode}
                                processedSegments={processedSegments}
                                setHoveredCodeText={setHoveredCodeText}
                                level={0}
                            />
                        </div>
                    </div>
                </div>
                <div className="w-1/3 pl-4 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                        <RelatedCodes
                            postId={post.id}
                            datasetId={post.dataset_id}
                            codeSet={additionalCodes}
                            codeResponses={codeResponses}
                            codeColors={codeColors}
                            codeCounts={additionalCodes.reduce(
                                (acc, code) => {
                                    acc[code] = codeResponses.filter(
                                        (response) =>
                                            response.code === code && response.postId === post.id
                                    ).length;
                                    return acc;
                                },
                                {} as Record<string, number>
                            )}
                            dispatchFunction={dispatchCodeResponse}
                            conflictingCodes={conflictingCodes}
                        />
                    </div>
                </div>
                {isAddCodeModalOpen && isActive && (
                    <AddCodeModal
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        setCodes={setAdditionalCodes}
                        setSelectedCode={setSelectedCode}
                        setAddHighlightModalHidden={setAddHighlightModalHidden}
                    />
                )}
                {isEditCodeModalOpen && isActive && (
                    <EditCodeModal
                        setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={(value: any) => setCodes(value, 'UPDATE_CODE_NAME')}
                        codes={additionalCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isDeleteCodeModalOpen && isActive && (
                    <DeleteCodeModal
                        setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={(value: any) => setCodes(value, 'DELETE_CODE')}
                        codes={additionalCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isHighlightModalOpen && isActive && (
                    <HighlightModal
                        hidden={addHighlightModalHidden}
                        setHidden={setAddHighlightModalHidden}
                        codes={[
                            ...new Set([
                                ...additionalCodes,
                                ...codeResponses.map((response) => response.code)
                            ])
                        ]}
                        selectedCode={selectedCode}
                        setSelectedCode={setSelectedCode}
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        applyCodeToSelection={() => applyCodeToSelection('ADD_HIGHLIGHT')}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        addReasoning={true}
                        reasoning={reasoning}
                        setReasoning={setReasoning}
                        restoreSelection={restoreSelection}
                        removeSelection={removeSelection}
                    />
                )}
                {isEditHighlightModalOpen && isActive && (
                    <EditHighlightModal
                        references={references}
                        applyCodeToSelection={(extra) =>
                            applyCodeToSelection('EDIT_HIGHLIGHT', extra)
                        }
                        setIsHighlightModalOpen={setIsEditHighlightModalOpen}
                        selectedText={selectedText}
                        setSelectedText={setSelectedText}
                    />
                )}
                {isDeleteHighlightModalOpen && isActive && (
                    <DeleteHighlightModal
                        references={references}
                        setReferences={setReferences}
                        applyCodeToSelection={(extra) =>
                            applyCodeToSelection('DELETE_HIGHLIGHT', extra)
                        }
                        setIsHighlightModalOpen={setDeleteIsHighlightModalOpen}
                    />
                )}
                {switchModalOn && (
                    <SwitchModal
                        message="To make changes to codes, change to edit mode and try again"
                        onCancel={() => setSwitchModalOn(false)}
                        onConfirm={() => {
                            handleSwitchToEditMode?.();
                            setSwitchModalOn(false);
                        }}
                        confirmLabel="Change to Edit Mode"
                    />
                )}
            </div>
        </div>
    );
};

export default PostTranscript;
