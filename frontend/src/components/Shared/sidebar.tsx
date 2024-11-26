import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../router';
import { RouteObject } from 'react-router-dom';

// Format route names for display
const formatRouteName = (path: string) => {
    return path
        .replace(/#/g, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Define keywords to filter out paths
const IGNORED_KEYWORDS = ['*', '/', 'loader'];

export const Sidebar: FC = () => {
    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    const toggleDropdown = (path: string) => {
        setOpenDropdowns((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    const shouldIgnoreRoute = (path: string | undefined) => {
        if (!path) return false;
        return IGNORED_KEYWORDS.some((keyword) => path.toLowerCase().includes(keyword));
    };

    const renderRoutes = (routes: RouteObject[], parentPath = ''): JSX.Element[] => {
        return routes
            .filter((route) => !shouldIgnoreRoute(route.path)) // Filter ignored routes
            .map((route, idx) => {
                // Handle protected routes with undefined paths
                if (route.path === undefined && route.children) {
                    return <div key={idx}>{renderRoutes(route.children, parentPath)}</div>;
                }

                const fullPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');

                console.log(fullPath);

                if (route.children) {
                    return (
                        <li key={idx} className="mb-2">
                            <button
                                className="w-full text-left flex justify-between items-center p-2 rounded-lg hover:bg-gray-700 transition duration-300"
                                onClick={() => toggleDropdown(fullPath)}>
                                <span className="font-medium">
                                    {formatRouteName(route.path || '')}
                                </span>
                                <span
                                    className={`transform transition-transform duration-300 ${
                                        openDropdowns.has(fullPath) ? 'rotate-180' : 'rotate-0'
                                    }`}>
                                    ▼
                                </span>
                            </button>
                            {openDropdowns.has(fullPath) && (
                                <ul className="ml-4 border-l border-gray-700 pl-2 mt-2">
                                    {renderRoutes(route.children, fullPath)}
                                </ul>
                            )}
                        </li>
                    );
                }

                return (
                    <li key={idx} className="mb-2">
                        <Link
                            to={fullPath}
                            className="block p-2 rounded-lg hover:bg-gray-700 transition duration-300 font-medium">
                            {formatRouteName(route.path || 'Home')}
                        </Link>
                    </li>
                );
            });
    };

    return (
        <div className="sidebar w-48 h-screen bg-gray-800 text-white fixed overflow-y-auto shadow-lg">
            <nav>
                <ul className="p-4">{renderRoutes(AppRoutes)}</ul>
            </nav>
        </div>
    );
};
