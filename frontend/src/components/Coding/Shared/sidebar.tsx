import { FC } from 'react';
import { ROUTES } from '../../../constants/Coding/shared';

export const Sidebar: FC = () => {
    return (
        <div className="w-32 h-screen bg-gray-800 text-white fixed">
            <nav className="">
                <ul>
                    {(Object.keys(ROUTES) as Array<keyof typeof ROUTES>).map((route, idx) => (
                        <a key={idx} href={ROUTES[route]}>
                            <li className="p-4 hover:bg-gray-700 capitalize">
                                {route.toLowerCase().replaceAll('_', ' ')}
                            </li>
                        </a>
                    ))}
                </ul>
            </nav>
        </div>
    );
};
