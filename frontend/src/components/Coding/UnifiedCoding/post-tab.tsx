import { FC } from 'react';

interface PostTabProps {
    postIdTitle: {
        id: string;
        title: string;
    };
    selectedItem: string | null;
    handleSelect: (postId: string) => void;
}

const PostTab: FC<PostTabProps> = ({ postIdTitle, selectedItem, handleSelect }) => {
    return (
        <li
            key={postIdTitle.id}
            className={`p-3 border rounded shadow cursor-pointer transition-all truncate ${
                selectedItem === postIdTitle.id ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
            }`}
            onClick={() => handleSelect(postIdTitle.id)}>
            {postIdTitle.title}
        </li>
    );
};

export default PostTab;
