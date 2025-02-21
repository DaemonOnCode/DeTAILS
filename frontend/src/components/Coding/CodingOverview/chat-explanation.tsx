import { FC, useState } from 'react';
import { generateColor } from '../../../utility/color-generator';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../../constants/Shared';

interface Message {
    id: number;
    text: string;
    sender: 'LLM' | 'Human';
    reaction?: boolean; // true for tick, false for cross, undefined for no reaction
    isEditable?: boolean; // true if a comment is currently being composed
    isThinking?: boolean; // true if the message is waiting for a backend response
    code?: string; // Only the initial message has code
}

interface ChatExplanationProps {
    initialExplanationWithCode: {
        explanation: string;
        code: string;
        fullText: string; // used as transcript
    };
    postId: string;
    datasetId: string;
}

const ChatExplanation: FC<ChatExplanationProps> = ({
    initialExplanationWithCode,
    datasetId,
    postId
}) => {
    // Create the initial message which has both code and explanation.
    const initialMessage: Message = {
        id: 1,
        text: initialExplanationWithCode.explanation,
        sender: 'LLM',
        code: initialExplanationWithCode.code,
        reaction: undefined,
        isEditable: false
    };

    const { getServerUrl } = useServerUtils();

    const [messages, setMessages] = useState<Message[]>([initialMessage]);
    // Store per-message input for comment boxes.
    const [editableInputs, setEditableInputs] = useState<{ [key: number]: string }>({});

    // Define consistent background colors for non-initial messages.
    const LLM_BG_COLOR = 'bg-gray-200';
    const HUMAN_BG_COLOR = 'bg-blue-100';

    // Determines whether the reaction for a message at index "i" is editable.
    const isReactionEditable = (i: number): boolean => {
        if (i === messages.length - 1) return true;
        const nextMsg = messages[i + 1];
        return !!(nextMsg && (nextMsg.isThinking || nextMsg.isEditable));
    };

    // Compute chat history as a concatenated string including sender labels.
    const computeChatHistory = () => {
        return messages.map((msg) => `${msg.sender}: ${msg.text}`);
    };

    // Handle sending a comment from an editable message box.
    const handleSendComment = async (messageId: number) => {
        const comment = editableInputs[messageId]?.trim();
        if (!comment) return;

        // Finalize the current Human message.
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === messageId ? { ...msg, text: comment, isEditable: false } : msg
            )
        );
        setEditableInputs((prev) => ({ ...prev, [messageId]: '' }));

        // If the comment comes from Human, automatically add a new LLM message in "thinking" state.
        const sourceMessage = messages.find((msg) => msg.id === messageId);
        if (sourceMessage && sourceMessage.sender === 'Human') {
            const newMessageId = messages.length + 1;
            const newLLMMessage: Message = {
                id: newMessageId,
                text: 'thinking...',
                sender: 'LLM',
                isThinking: true,
                reaction: undefined,
                isEditable: false
            };
            setMessages((prev) => [...prev, newLLMMessage]);

            // Prepare the payload with all relevant data.
            const payload = {
                dataset_id: datasetId,
                post_id: postId,
                code: initialExplanationWithCode.code,
                quote: initialExplanationWithCode.explanation,
                chat_history: [...computeChatHistory(), `Human: ${comment}`],
                model: MODEL_LIST.GEMINI_FLASH
                // user_comment: comment
            };

            try {
                const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REFINE_CODE), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === newMessageId
                            ? { ...msg, text: data.explanation, isThinking: false }
                            : msg
                    )
                );
            } catch (error) {
                console.error('Error sending comment:', error);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === newMessageId
                            ? {
                                  ...msg,
                                  text: 'There was an error. Please try again.',
                                  isThinking: false
                              }
                            : msg
                    )
                );
            }
        }
    };

    // Handle reaction icon clicks.
    // For an LLM message:
    // - Tick (true) means the user accepts the answer: any following editable Human comment box is removed.
    // - Cross (false) means the user rejects the answer: create a new Human comment box only if one doesn't already exist.
    // For a Human message, a tick finalizes its content.
    const handleReaction = (messageId: number, reaction: boolean, index: number) => {
        if (!isReactionEditable(index)) return;
        const currentMsg = messages.find((msg) => msg.id === messageId);
        if (!currentMsg) return;

        if (currentMsg.sender === 'LLM') {
            if (reaction === true) {
                // User accepts LLM's answer.
                setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === messageId);
                    if (
                        prev[idx + 1] &&
                        prev[idx + 1].sender === 'Human' &&
                        prev[idx + 1].isEditable
                    ) {
                        // Remove the pending Human comment box.
                        return [...prev.slice(0, idx + 1), ...prev.slice(idx + 2)];
                    }
                    return prev;
                });
                // Mark the LLM message as accepted.
                setMessages((prev) =>
                    prev.map((msg) => (msg.id === messageId ? { ...msg, reaction: true } : msg))
                );
            } else if (reaction === false) {
                // User rejects LLM's answer.
                // Only create a new Human comment box if one isn't already present.
                const lastMsg = messages[messages.length - 1];
                if (!(lastMsg.sender === 'Human' && lastMsg.isEditable)) {
                    const newMessageId = messages.length + 1;
                    const newMessage: Message = {
                        id: newMessageId,
                        text: '',
                        sender: 'Human',
                        reaction: undefined,
                        isEditable: true,
                        isThinking: false
                    };
                    setMessages((prev) => [...prev, newMessage]);
                }
                // Mark the LLM message as rejected.
                setMessages((prev) =>
                    prev.map((msg) => (msg.id === messageId ? { ...msg, reaction: false } : msg))
                );
            }
        } else if (currentMsg.sender === 'Human') {
            // Reaction on a Human message.
            if (reaction === true && currentMsg.isEditable) {
                // Finalize the comment box.
                const finalText = editableInputs[messageId] || currentMsg.text;
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId
                            ? { ...msg, text: finalText, isEditable: false, reaction: true }
                            : msg
                    )
                );
                setEditableInputs((prev) => ({ ...prev, [messageId]: '' }));
            }
            // Cross reaction on a Human message is not handled.
        }
    };

    // Render a single message, including its text (or textarea if being edited) and tick/cross icons.
    const renderMessage = (msg: Message, index: number) => {
        let bgColor = '';
        if (msg.code) {
            bgColor = generateColor(msg.code);
        } else {
            bgColor = msg.sender === 'LLM' ? LLM_BG_COLOR : HUMAN_BG_COLOR;
        }
        const reactionEditable = isReactionEditable(index);

        return (
            <div
                key={msg.id}
                className="mb-2 p-2 rounded flex justify-between items-start"
                style={{ backgroundColor: bgColor }}>
                <div className="flex-1">
                    {msg.code && <span className="p-2 rounded mb-2 block">Code: {msg.code}</span>}
                    {msg.isEditable ? (
                        <div className="relative">
                            <textarea
                                className="w-full p-2 border rounded"
                                placeholder="Add your comment..."
                                value={editableInputs[msg.id] || ''}
                                onChange={(e) =>
                                    setEditableInputs((prev) => ({
                                        ...prev,
                                        [msg.id]: e.target.value
                                    }))
                                }
                            />
                            <button
                                onClick={() => handleSendComment(msg.id)}
                                className="absolute right-2 top-2"
                                aria-label="Send Comment">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-blue-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M14 5l7 7-7 7M5 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <span>{msg.text}</span>
                    )}
                </div>
                <div className="ml-2 flex flex-col space-y-1">
                    <button
                        onClick={() => handleReaction(msg.id, true, index)}
                        aria-label="Agree"
                        disabled={!reactionEditable}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </button>
                    <button
                        onClick={() => handleReaction(msg.id, false, index)}
                        aria-label="Disagree"
                        disabled={!reactionEditable}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="border rounded p-4 mb-4">
            <button
                onClick={() => {}}
                className="mb-2 p-2 rounded bg-gray-300 hover:bg-gray-400"
                aria-label="Toggle Chat">
                Chat
            </button>
            <div className="max-h-96 overflow-y-auto">
                {messages.map((msg, index) => renderMessage(msg, index))}
            </div>
        </div>
    );
};

export default ChatExplanation;
