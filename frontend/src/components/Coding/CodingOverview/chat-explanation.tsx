import { FC, useState } from 'react';
import { FaRedoAlt } from 'react-icons/fa';
import { generateColor } from '../../../utility/color-generator';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { ChatCommands, ChatMessage } from '../../../types/Coding/shared';

interface ChatExplanationProps {
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
    initialExplanationWithCode,
    datasetId,
    postId,
    dispatchFunction,
    existingChatHistory
}) => {
    const initialMsg: ChatMessage = {
        id: 1,
        text: initialExplanationWithCode.explanation,
        sender: 'LLM',
        code: initialExplanationWithCode.code,
        reaction: undefined,
        isEditable: false,
        command: 'ACCEPT_QUOTE'
    };

    const { getServerUrl } = useServerUtils();

    const [messages, setMessages] = useState<ChatMessage[]>(
        existingChatHistory.length > 0 ? existingChatHistory : [initialMsg]
    );
    const [editableInputs, setEditableInputs] = useState<{ [key: number]: string }>({});
    const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
    // New state for tracking a selected code for messages that need editing.
    const [selectedCodes, setSelectedCodes] = useState<{ [key: number]: string }>({});

    const updateMessagesAndStore = (updatedMsgs: ChatMessage[]) => {
        setMessages(updatedMsgs);
        dispatchFunction({
            type: 'SET_CHAT_HISTORY',
            postId,
            sentence: initialExplanationWithCode.fullText,
            code: initialExplanationWithCode.code,
            chatHistory: updatedMsgs
        });
    };

    const handleToggleChat = () => setChatCollapsed((p) => !p);

    // We allow reaction if no prior reaction was chosen, and it's the last or next is thinking
    const isReactionEditable = (msg: ChatMessage, i: number): boolean => {
        if (i === messages.length - 1) return true;
        const nextMsg = messages[i + 1];
        return !!(nextMsg && (nextMsg.isThinking || nextMsg.isEditable));
    };

    // Build a simple chat history string
    const computeChatHistory = () => messages.map((m) => `${m.sender}: ${m.text}`);

    const handleSendComment = async (messageId: number) => {
        const comment = editableInputs[messageId]?.trim();
        if (!comment) return;

        let newMsgs = messages.map((msg) =>
            msg.id === messageId ? { ...msg, text: comment, isEditable: false } : msg
        );
        setEditableInputs((prev) => ({ ...prev, [messageId]: '' }));

        // Create a new "thinking" LLM message
        const source = messages.find((m) => m.id === messageId);
        if (source && source.sender === 'Human') {
            const newId = messages.length + 1;
            newMsgs = [
                ...newMsgs,
                { id: newId, text: 'Thinking...', sender: 'LLM', isThinking: true }
            ];
        }
        updateMessagesAndStore(newMsgs);

        // Now call your backend
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
            console.log(data, 'chat res');
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

            // If there's an "agreement", mark the last Human message
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

    // 4) Reaction logic (accept or reject LLM)
    const handleReaction = (messageId: number, reaction: boolean, i: number) => {
        const current = messages.find((m) => m.id === messageId);
        if (!current || current.sender !== 'LLM') return;

        let newMsgs = [...messages];
        const idx = newMsgs.findIndex((m) => m.id === messageId);

        if (reaction) {
            // Accept
            if (
                newMsgs[idx + 1] &&
                newMsgs[idx + 1].sender === 'Human' &&
                newMsgs[idx + 1].isEditable
            ) {
                newMsgs = [...newMsgs.slice(0, idx + 1), ...newMsgs.slice(idx + 2)];
            }
            const oldReaction = newMsgs[idx].reaction;
            newMsgs[idx].reaction = oldReaction === true ? undefined : true;

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
            } else if (current.command === 'EDIT_QUOTE') {
                dispatchFunction({
                    type: 'UPDATE_CODE',
                    prevCode: initialExplanationWithCode.code,
                    quote: initialExplanationWithCode.fullText,
                    newCode: selectedCodes[messageId]
                });

                dispatchFunction({
                    type: 'MARK_RESPONSE_BY_CODE_EXPLANATION',
                    postId,
                    quote: initialExplanationWithCode.fullText,
                    code: selectedCodes[messageId],
                    isMarked: true
                });
            }
        } else {
            // Reject
            const last = newMsgs[newMsgs.length - 1];
            if (!(last.sender === 'Human' && last.isEditable)) {
                newMsgs.push({
                    id: newMsgs.length + 1,
                    text: '',
                    sender: 'Human',
                    isEditable: true
                });
            }
            const oldReaction = newMsgs[idx].reaction;
            newMsgs[idx].reaction = oldReaction === false ? undefined : false;
            if (initialExplanationWithCode?.code !== existingChatHistory?.[0]?.code) {
                dispatchFunction({
                    type: 'UPDATE_CODE',
                    prevCode: initialExplanationWithCode.code,
                    quote: initialExplanationWithCode.fullText,
                    newCode: existingChatHistory[0].code
                });
            }
        }

        updateMessagesAndStore(newMsgs);
    };

    // 5) "Refresh" to re-fetch or re-generate the LLM message
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
            console.log(data, 'jhuhhg');
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
                    ? {
                          ...m,
                          text: 'There was an error. Please try again.',
                          isThinking: false
                      }
                    : m
            );
            updateMessagesAndStore(errorMsgs);
        }
    };

    const visibleMessages = chatCollapsed ? messages.slice(0, 1) : messages;

    const renderMessage = (msg: ChatMessage, i: number) => {
        const isFirst = i === 0 && msg.code;
        const bg = isFirst
            ? generateColor(msg.code!)
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
                    {msg.code && (
                        <pre className="bg-gray-800 text-white p-2 rounded mb-2 whitespace-pre-wrap">
                            {msg.code}
                        </pre>
                    )}
                    {msg.isEditable ? (
                        <textarea
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Give feedback to AI..."
                            value={editableInputs[msg.id] || ''}
                            onChange={(e) =>
                                setEditableInputs((prev) => ({
                                    ...prev,
                                    [msg.id]: e.target.value
                                }))
                            }
                        />
                    ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    {msg.command === 'EDIT_QUOTE' && msg.text !== 'Thinking...' && (
                        <div className="">
                            <p className="text-sm font-medium mb-1">Choose a code:</p>
                            <div className="flex items-center space-x-2">
                                <select
                                    value={selectedCodes[msg.id] || ''}
                                    onChange={(e) =>
                                        setSelectedCodes((prev) => ({
                                            ...prev,
                                            [msg.id]: e.target.value
                                        }))
                                    }
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

                <div className="flex flex-col self-start ml-2 space-y-2 sticky top-2">
                    {msg.sender === 'LLM' ? (
                        <>
                            <button
                                onClick={() => handleReaction(msg.id, true, i)}
                                disabled={!canReact || msg.isThinking}
                                className={`w-8 h-8 flex items-center justify-center rounded
                  ${msg.reaction === true ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}
                  ${
                      !canReact || msg.isThinking
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-green-400'
                  }`}>
                                ✓
                            </button>

                            <button
                                onClick={() => handleReaction(msg.id, false, i)}
                                disabled={!canReact || msg.isThinking}
                                className={`w-8 h-8 flex items-center justify-center rounded
                  ${msg.reaction === false ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'}
                  ${
                      !canReact || msg.isThinking
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-red-400'
                  }`}>
                                ✕
                            </button>

                            {msg.id > 1 && (
                                <button
                                    onClick={() => handleRefreshLLM(msg.id)}
                                    disabled={msg.isThinking}
                                    className={`w-8 h-8 flex items-center justify-center rounded
                    bg-gray-300 text-gray-600 hover:bg-yellow-400 hover:text-white
                    ${msg.isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                className={`w-8 h-8 flex items-center justify-center rounded
                  ${msg.reaction === true ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}
                  ${
                      true //!canReact || msg.isThinking
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-green-400'
                  }`}>
                                ✓
                            </button>
                            <button
                                onClick={() => handleReaction(msg.id, false, i)}
                                disabled={true} //!canReact || msg.isThinking}
                                className={`w-8 h-8 flex items-center justify-center rounded
                  ${msg.reaction === false ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'}
                  ${
                      !canReact || msg.isThinking
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-red-400'
                  }`}>
                                ✕
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="border rounded p-4 mb-4">
            <button
                onClick={handleToggleChat}
                className="mb-2 p-2 rounded bg-gray-300 hover:bg-gray-400">
                {chatCollapsed ? 'Show Full Chat' : 'Collapse'}
            </button>
            <div className="max-h-96 overflow-y-auto relative">
                {(chatCollapsed ? messages.slice(0, 1) : messages).map((m, i) =>
                    renderMessage(m, i)
                )}
            </div>
        </div>
    );
};

export default ChatExplanation;
