import { FC } from 'react';

interface PostTab {
    resource: {
        read(): any;
    };
    selectedItem: string | null;
    handleSelect: (postId: string) => void;
}

const PostTab: FC<PostTab> = ({ resource, selectedItem, handleSelect }) => {
    const postIdTitle = resource.read();

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
