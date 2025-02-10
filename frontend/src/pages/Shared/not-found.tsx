import { FC } from 'react';
import { ROUTES } from '../../constants/Shared';
import { Link } from 'react-router-dom';

const NotFoundPage: FC = () => {
    console.log('404 Not Found');
    return (
        <div className="p-6">
            404 Not Found
            <button onClick={() => window.history.back()}>Go Back</button>
        </div>
    );
};

export default NotFoundPage;
