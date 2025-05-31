import { FC } from 'react';

interface PostTabProps {
    postIdTitle: {
        id: string;
        title: string;
    };
    selectedItem: string | null;
    handleSelect: (postId: string) => void;
    containerRef: React.RefObject<HTMLUListElement>;
    isCoded?: boolean;
}

const PostTab: FC<PostTabProps> = ({
    postIdTitle,
    selectedItem,
    handleSelect,
    containerRef,
    isCoded
}) => {
    const selectedPostId = selectedItem?.split('|')[0];
    return (
        <li
            className={`p-3 border rounded shadow cursor-pointer transition-all truncate ${
                selectedPostId === postIdTitle.id
                    ? 'bg-blue-200 font-bold'
                    : `hover:bg-blue-100 border-2 ${isCoded ? 'border-green-500' : ''}`
            }`}
            onClick={() => handleSelect(postIdTitle.id)}>
            {postIdTitle.title}
        </li>
    );
};

export default PostTab;
