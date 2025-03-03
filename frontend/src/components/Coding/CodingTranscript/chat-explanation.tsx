import { FC, useState } from 'react';
import { FaRedoAlt, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { generateColor } from '../../../utility/color-generator';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { ChatMessage } from '../../../types/Coding/shared';
import { useTranscriptContext } from '../../../context/transcript-context';

interface ChatExplanationProps {
    // review: boolean;
    initialExplanationWithCode: {
        explanation: string;
        code: string;
        fullText: string;
    };
    postId: string;
    datasetId: string;
    dispatchFunction: (action: any) => void;
    existingChatHistory: ChatMessage[];
}

const ChatExplanation: FC<ChatExplanationProps> = ({
    // review,
    initialExplanationWithCode,
    datasetId,
    postId,
    dispatchFunction,
    existingChatHistory
}) => {
    const { chatHistories, setChatHistories, review } = useTranscriptContext();
    const chatKey = `${postId}-${initialExplanationWithCode.code}-${initialExplanationWithCode.fullText}`;
    const initialMessages = chatHistories[chatKey] || existingChatHistory;

    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [editableInputs, setEditableInputs] = useState<{ [key: number]: string }>({});
    const [chatCollapsed, setChatCollapsed] = useState<boolean>(true && !!messages.length);

    const { getServerUrl } = useServerUtils();

    // Update local state and persist chat history.
    const updateMessagesAndStore = (updatedMsgs: ChatMessage[]) => {
        setMessages(updatedMsgs);
        setChatHistories((prev) => ({ ...prev, [chatKey]: updatedMsgs }));
        dispatchFunction({
            type: 'SET_CHAT_HISTORY',
            postId,
            sentence: initialExplanationWithCode.fullText,
            code: initialExplanationWithCode.code,
            chatHistory: updatedMsgs
        });
    };

    const handleToggleChat = () => setChatCollapsed((prev) => !prev);

    // Check if a given message can accept reactions.
    const isReactionEditable = (msg: ChatMessage, i: number): boolean => {
        if (i === messages.length - 1) return true;
        const nextMsg = messages[i + 1];
        return !!(nextMsg && (nextMsg.isThinking || nextMsg.isEditable));
    };

    // Compute the latest new code from EDIT_QUOTE messages (if any) from full history.
    const latestNewMessage = [...messages].reverse().find((message) => message.isCurrentCode);

    // console.log(latestNewMessage, 'latest', messages, initialExplanationWithCode);

    // Build chat history as an array of strings.
    const computeChatHistory = () => messages.map((m) => `${m.sender}: ${m.text}`);

    // Handle human feedback submission.
    const handleSendComment = async (messageId: number) => {
        const comment = editableInputs[messageId]?.trim();
        if (!comment) return;

        // Lock the current human message.
        let newMsgs = messages.map((msg) =>
            msg.id === messageId ? { ...msg, text: comment, isEditable: false } : msg
        );
        setEditableInputs((prev) => ({ ...prev, [messageId]: '' }));

        // Append an LLM placeholder if the feedback came from Human.
        const source = messages.find((m) => m.id === messageId);
        if (source && source.sender === 'Human') {
            const newId = messages.length + 1;
            newMsgs = [
                ...newMsgs,
                { id: newId, text: 'Thinking...', sender: 'LLM', isThinking: true }
            ];
        }
        updateMessagesAndStore(newMsgs);

        const payload = {
            dataset_id: datasetId,
            post_id: postId,
            code: initialExplanationWithCode.code,
            quote: initialExplanationWithCode.fullText,
            chat_history: [...computeChatHistory(), `Human: ${comment}`],
            model: MODEL_LIST.GEMINI_FLASH
        };

        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REFINE_CODE), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            const { explanation, agreement, command, alternate_codes } = data;

            let finalMsgs = newMsgs.map((msg) =>
                msg.id === newMsgs.length
                    ? {
                          ...msg,
                          text: explanation || 'No explanation returned.',
                          isThinking: false,
                          command,
                          alternate_codes
                      }
                    : msg
            );

            if (agreement) {
                const lastHumanIndex = [...finalMsgs]
                    .reverse()
                    .findIndex((m) => m.sender === 'Human');
                if (lastHumanIndex !== -1) {
                    const realIndex = finalMsgs.length - 1 - lastHumanIndex;
                    finalMsgs[realIndex] = {
                        ...finalMsgs[realIndex],
                        reaction: agreement === 'AGREE'
                    };
                }
            }

            updateMessagesAndStore(finalMsgs);
        } catch (err) {
            console.error('Error sending comment:', err);
            let errorMsgs = newMsgs.map((msg) =>
                msg.id === newMsgs.length
                    ? { ...msg, text: 'There was an error. Please try again.', isThinking: false }
                    : msg
            );
            updateMessagesAndStore(errorMsgs);
        }
    };

    const handleReaction = (messageId: number, reaction: boolean | undefined, i: number) => {
        // Open full chat if currently collapsed and only the first message is shown.
        if (chatCollapsed && messages.length === 1) {
            setChatCollapsed(false);
        }

        const current = messages.find((m) => m.id === messageId);
        if (!current || current.sender !== 'LLM') return;

        let newMsgs = [...messages];
        const idx = newMsgs.findIndex((m) => m.id === messageId);

        // Remove any pending human editable message immediately following.
        if (
            newMsgs[idx + 1] &&
            newMsgs[idx + 1].sender === 'Human' &&
            newMsgs[idx + 1].isEditable
        ) {
            newMsgs.splice(idx + 1, 1);
        }

        const latestMessageWithCode = newMsgs.find((m) => m.isCurrentCode);

        console.log(latestMessageWithCode, 'latest mc');

        const currentReaction = reaction === current.reaction ? undefined : reaction;

        // When reaction is true (tick).
        if (currentReaction) {
            // Toggle the reaction: if already true, unset it.
            // const oldReaction = newMsgs[idx].reaction;
            newMsgs[idx].reaction = true; //oldReaction === true ? undefined : true;

            // For non-EDIT_QUOTE commands, dispatch as before.
            if (current.command === 'REMOVE_QUOTE') {
                dispatchFunction({
                    type: 'MARK_RESPONSE_BY_CODE_EXPLANATION',
                    postId,
                    quote: initialExplanationWithCode.fullText,
                    code: initialExplanationWithCode.code,
                    isMarked: false
                });
            } else if (current.command === 'ACCEPT_QUOTE') {
                dispatchFunction({
                    type: 'MARK_RESPONSE_BY_CODE_EXPLANATION',
                    postId,
                    quote: initialExplanationWithCode.fullText,
                    code: initialExplanationWithCode.code,
                    isMarked: true
                });
            } else if (current.command === 'EDIT_QUOTE' && current.code) {
                // Only mark as current code if the command is EDIT_QUOTE and code exists.

                dispatchFunction({
                    type: 'UPDATE_CODE',
                    prevCode: latestMessageWithCode?.code,
                    quote: initialExplanationWithCode.fullText,
                    newCode: current.code
                });

                newMsgs = newMsgs.map((m) => ({
                    ...m,
                    // Set isCurrentCode true only on the message being approved.
                    isCurrentCode: m.id === messageId ? true : false
                }));
                dispatchFunction({
                    type: 'MARK_RESPONSE_BY_CODE_EXPLANATION',
                    postId,
                    quote: initialExplanationWithCode.fullText,
                    code: current.code,
                    isMarked: true
                });
            }
        } else if (currentReaction === false) {
            console.log('Reaction', reaction);
            // Reaction is false (cross) or toggled to undefined.
            // Spawn human feedback if not already present.
            const last = newMsgs[newMsgs.length - 1];
            if (!(last.sender === 'Human' && last.isEditable)) {
                newMsgs.push({
                    id: newMsgs.length + 1,
                    text: '',
                    sender: 'Human',
                    isEditable: true
                });
            }
            // const oldReaction = newMsgs[idx].reaction;
            newMsgs[idx].reaction = false;

            console.log('Reaction 2', newMsgs);

            // If this message was marked as current (only possible for EDIT_QUOTE messages),
            // then try reverting to a previous code.
            if (current.command === 'EDIT_QUOTE') {
                const previousMsg = newMsgs[0];
                console.log('Reaction 3', previousMsg);
                // const previousMsg = newMsgs
                //     .slice(0, idx)
                //     .reverse()
                //     .find((m) => m.code && m.command === 'EDIT_QUOTE');
                if (previousMsg) {
                    dispatchFunction({
                        type: 'UPDATE_CODE',
                        prevCode: current?.code,
                        quote: initialExplanationWithCode.fullText,
                        newCode: previousMsg.code
                    });
                    newMsgs = newMsgs.map((m) => ({
                        ...m,
                        isCurrentCode: m.id === previousMsg.id ? true : false
                    }));
                }
            }
        } else {
            // Reaction is toggled to undefined.
            newMsgs[idx].reaction = undefined;

            if (current.command === 'EDIT_QUOTE') {
                const previousMsg = newMsgs[0];
                console.log('Reaction 3', previousMsg);
                // const previousMsg = newMsgs
                //     .slice(0, idx)
                //     .reverse()
                //     .find((m) => m.code && m.command === 'EDIT_QUOTE');
                if (previousMsg) {
                    dispatchFunction({
                        type: 'UPDATE_CODE',
                        prevCode: current?.code,
                        quote: initialExplanationWithCode.fullText,
                        newCode: previousMsg.code
                    });
                    newMsgs = newMsgs.map((m) => ({
                        ...m,
                        isCurrentCode: m.id === previousMsg.id ? true : false
                    }));
                }
            }
        }

        updateMessagesAndStore(newMsgs);
    };

    // Handle LLM refresh.
    const handleRefreshLLM = async (messageId: number) => {
        const idx = messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return;

        let newMsgs = messages.map((m) =>
            m.id === messageId ? { ...m, text: 'Thinking...', isThinking: true } : m
        );
        updateMessagesAndStore(newMsgs);

        const partialHistory = messages.slice(0, idx).map((m) => `${m.sender}: ${m.text}`);

        const payload = {
            dataset_id: datasetId,
            post_id: postId,
            code: initialExplanationWithCode.code,
            quote: initialExplanationWithCode.fullText,
            chat_history: partialHistory,
            model: MODEL_LIST.GEMINI_FLASH
        };

        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REFINE_CODE), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            const { explanation, command, alternate_codes } = data;

            let finalMsgs = newMsgs.map((m) =>
                m.id === messageId
                    ? {
                          ...m,
                          text: explanation || 'No explanation returned.',
                          isThinking: false,
                          command,
                          alternate_codes
                      }
                    : m
            );
            updateMessagesAndStore(finalMsgs);
        } catch (err) {
            console.error('Error refreshing LLM message:', err);
            let errorMsgs = newMsgs.map((m) =>
                m.id === messageId
                    ? { ...m, text: 'There was an error. Please try again.', isThinking: false }
                    : m
            );
            updateMessagesAndStore(errorMsgs);
        }
    };

    // Render an individual message.
    const renderMessage = (msg: ChatMessage, i: number) => {
        const isInitial = i === 0 && msg.code;
        const bg = isInitial
            ? latestNewMessage?.code && latestNewMessage.reaction
                ? generateColor(latestNewMessage.code)
                : generateColor(msg.code ?? '')
            : msg.sender === 'LLM'
              ? '#f3f4f6'
              : '#eff6ff';

        const chainStyle =
            msg.sender === 'Human' && msg.isEditable ? 'border-l-4 border-gray-300 pl-4' : '';
        const canReact = isReactionEditable(msg, i);

        return (
            <div key={msg.id} className="flex mb-4 w-full">
                <div
                    className={`relative flex-1 p-4 rounded ${chainStyle}`}
                    style={{ backgroundColor: bg }}>
                    {isInitial ? (
                        latestNewMessage?.code !== messages[0].code ? (
                            <pre className="bg-gray-800 text-white p-2 rounded mb-2 whitespace-pre-wrap">
                                <span
                                    style={{ textDecoration: 'line-through', marginRight: '8px' }}>
                                    {msg.code}
                                </span>{' '}
                                <span>{latestNewMessage?.code}</span>
                            </pre>
                        ) : (
                            <pre className="bg-gray-800 text-white p-2 rounded mb-2 whitespace-pre-wrap">
                                {msg.code}
                            </pre>
                        )
                    ) : null}

                    {msg.isEditable ? (
                        <textarea
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Give feedback to AI..."
                            value={editableInputs[msg.id] || ''}
                            onChange={(e) =>
                                setEditableInputs((prev) => ({ ...prev, [msg.id]: e.target.value }))
                            }
                        />
                    ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {msg.command === 'EDIT_QUOTE' && msg.text !== 'Thinking...' && (
                        <div>
                            <p className="text-sm font-medium mb-1">Choose a code:</p>
                            <div className="flex items-center space-x-2">
                                <select
                                    value={msg.code || ''}
                                    onChange={(e) => {
                                        const newCode = e.target.value;
                                        const currentMsg = messages.find((m) => m.id === msg.id);
                                        const updatedMessages = messages.map((m) =>
                                            m.id === msg.id
                                                ? {
                                                      ...m,
                                                      code: newCode,
                                                      reaction: undefined,
                                                      isCurrentCode: false
                                                  }
                                                : m
                                        );
                                        updatedMessages[0].isCurrentCode = true;
                                        updateMessagesAndStore(updatedMessages);
                                        dispatchFunction({
                                            type: 'UPDATE_CODE',
                                            prevCode: currentMsg?.code,
                                            quote: initialExplanationWithCode.fullText,
                                            newCode: messages[0].code
                                        });
                                        // handleReaction(msg.id, currentMsg?.reaction, i);
                                    }}
                                    className="p-1 border rounded w-full">
                                    <option value="">Select a code</option>
                                    {msg.alternate_codes &&
                                        msg.alternate_codes.map((codeOption, idx) => (
                                            <option key={idx} value={codeOption}>
                                                {codeOption}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Reaction Buttons */}
                {!review && (
                    <div className="flex flex-col self-start ml-2 space-y-2 sticky top-2">
                        {msg.sender === 'LLM' ? (
                            <>
                                <button
                                    onClick={() => handleReaction(msg.id, true, i)}
                                    disabled={!canReact || msg.isThinking}
                                    className={`w-8 h-8 flex items-center justify-center rounded ${
                                        msg.reaction === true
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-300 text-gray-500'
                                    } ${!canReact || msg.isThinking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-400'}`}>
                                    ✓
                                </button>
                                <button
                                    onClick={() => handleReaction(msg.id, false, i)}
                                    disabled={!canReact || msg.isThinking}
                                    className={`w-8 h-8 flex items-center justify-center rounded ${
                                        msg.reaction === false
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-300 text-gray-500'
                                    } ${!canReact || msg.isThinking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-400'}`}>
                                    ✕
                                </button>
                                {msg.id > 1 && (
                                    <button
                                        onClick={() => handleRefreshLLM(msg.id)}
                                        disabled={msg.isThinking}
                                        className={`w-8 h-8 flex items-center justify-center rounded bg-gray-300 text-gray-600 hover:bg-yellow-400 hover:text-white ${
                                            msg.isThinking ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        title="Refresh">
                                        <FaRedoAlt className="h-4 w-4" />
                                    </button>
                                )}
                            </>
                        ) : msg.isEditable ? (
                            <button
                                onClick={() => handleSendComment(msg.id)}
                                className="w-8 h-8 flex items-center justify-center rounded bg-gray-300 text-gray-600 hover:bg-blue-400 hover:text-white">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 4l16 8-16 8 4-8-4-8z"
                                    />
                                </svg>
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleReaction(msg.id, true, i)}
                                    disabled={!canReact || msg.isThinking}
                                    className={`w-8 h-8 flex items-center justify-center rounded ${
                                        msg.reaction === true
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-300 text-gray-500'
                                    } opacity-50 cursor-not-allowed`}>
                                    ✓
                                </button>
                                <button
                                    onClick={() => handleReaction(msg.id, false, i)}
                                    disabled={true}
                                    className={`w-8 h-8 flex items-center justify-center rounded ${
                                        msg.reaction === false
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-300 text-gray-500'
                                    } ${!canReact || msg.isThinking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-400'}`}>
                                    ✕
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="border rounded p-4 mb-4 relative">
            <div className="flex">
                {/* Sticky Toggle Button on the left */}
                <div className="sticky top-2 mr-2 self-start">
                    <button
                        onClick={handleToggleChat}
                        className="p-1 rounded bg-gray-300 hover:bg-gray-400">
                        {chatCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                    </button>
                </div>
                {/* Chat Content */}
                <div className="flex-1">
                    <div className="max-h-72 overflow-y-auto relative">
                        {(chatCollapsed ? messages.slice(0, 1) : messages).map((m, i) =>
                            renderMessage(m, i)
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatExplanation;
