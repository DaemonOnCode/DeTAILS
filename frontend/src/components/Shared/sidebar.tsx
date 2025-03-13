import { FC, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RouteObject } from 'react-router-dom';
import { LOADER_TO_ROUTE_MAP, RouteIcons, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { AppRouteArray } from '../../types/Shared';
import { ROUTES as CODING_ROUTES } from '../../constants/Coding/shared';
import { useWorkspaceContext } from '../../context/workspace-context';
import { DetailsIcon } from './Icons';

// Format route names for display
const formatRouteName = (path: string, workspaceName: string = 'Temporary') => {
    if (path === 'coding') {
        return (
            <span className="overflow-wrap flex items-center gap-1">
                <span className="inline-flex items-center">
                    <DetailsIcon className="h-6 w-6 inline-block" />:
                </span>
                {workspaceName}
            </span>
        );
    }
    return path
        .replace(/#/g, '')
        .replace(/_/g, '<_> ')
        .replace(/-/g, ' ')
        .toLowerCase()
        .replace('authenticated', '')
        .replace(' v2', '')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replaceAll('<_> ', '');
};

// Define keywords to filter out paths
const IGNORED_KEYWORDS = [
    '*',
    '/',
    'loader',
    SHARED_ROUTES.CLEANING,
    SHARED_ROUTES.DATA_COLLECTION,
    SHARED_ROUTES.DATA_MODELING,
    SHARED_ROUTES.SETTINGS,
    CODING_ROUTES.TRANSCRIPT,
    CODING_ROUTES.TRANSCRIPTS,
    CODING_ROUTES.MANUAL_CODING,
    CODING_ROUTES.HOME,
    SHARED_ROUTES.AUTHENTICATED_SETTINGS
];

interface SidebarProps {
    routes: AppRouteArray;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const Sidebar: FC<SidebarProps> = ({ routes, isCollapsed, onToggleCollapse }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { currentWorkspace } = useWorkspaceContext();
    const [userDropdownVisible, setUserDropdownVisible] = useState<boolean>(false);

    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    const searchParams = new URLSearchParams(location.search);

    const forcedActiveRoute = searchParams.get('sidebarActive');

    useEffect(() => {
        if (isRouteHighlighted(location.pathname)) {
            const segments = location.pathname.split('/').filter(Boolean);
            const newOpenDropdowns = openDropdowns;
            let currentPath = '';
            segments.forEach((segment) => {
                currentPath += `/${segment}`;
                newOpenDropdowns.add(currentPath);
            });
            setOpenDropdowns(newOpenDropdowns);
        }
    }, [location.pathname]);

    const toggleDropdown = (path: string) => {
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        setOpenDropdowns((prev) => {
            const newSet = new Set(prev);
            newSet.has(normalizedPath) ? newSet.delete(normalizedPath) : newSet.add(normalizedPath);
            return newSet;
        });
    };

    // Check if a route should be ignored
    const shouldIgnoreRoute = (path: string | undefined) => {
        if (!path) return false;
        return IGNORED_KEYWORDS.some((keyword) => path.toLowerCase() === keyword);
    };

    // Highlight current route
    const isCurrentPath = (fullPath: string) => location.pathname === fullPath;

    // Find the default route (index: true) within children
    const findDefaultRoute = (children: RouteObject[]): string | null => {
        const indexRoute = children.find((child) => child.index);
        return indexRoute ? indexRoute.path || '' : null;
    };

    const findRouteFullPath = (
        routes: AppRouteArray,
        targetPath: string,
        parentPath: string = ''
    ): string | null => {
        for (const route of routes) {
            if (route.hidden) continue; // Skip hidden routes normally
            if (route.path) {
                const fullPath = `${parentPath}/${route.path}`.replace(/\/+/g, '/');
                if (route.path === targetPath) {
                    return fullPath;
                }
                if (route.children) {
                    const result = findRouteFullPath(route.children, targetPath, fullPath);
                    if (result) return result;
                }
            }
        }
        return null;
    };

    function isRouteHighlighted(fullPath: string, routePath?: string) {
        if (forcedActiveRoute && forcedActiveRoute === routePath) {
            return true;
        }

        if (LOADER_TO_ROUTE_MAP[location.pathname] === fullPath) {
            return true;
        }

        return location.pathname === fullPath;
    }

    useEffect(() => {
        if (forcedActiveRoute) {
            const forcedFullPath = findRouteFullPath(routes, forcedActiveRoute);
            if (forcedFullPath) {
                const segments = forcedFullPath.split('/').filter(Boolean);
                let currentPath = '';
                const newOpenDropdowns = new Set<string>();
                segments.forEach((segment) => {
                    currentPath += `/${segment}`;
                    newOpenDropdowns.add(currentPath);
                });
                setOpenDropdowns(newOpenDropdowns);
            }
        }
        // We intentionally do not reinitialize openDropdowns on every location change
        // so that manual toggles persist.
    }, [forcedActiveRoute, routes]);

    // Render the routes recursively
    const renderRoutes = (routes: AppRouteArray, parentPath = ''): JSX.Element[] => {
        return routes
            .filter((route) => !shouldIgnoreRoute(route.path) && route.hidden !== true)
            .map((route, idx) => {
                if (route.path === undefined && route.children) {
                    return <div key={idx}>{renderRoutes(route.children, parentPath)}</div>;
                }

                const fullPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');

                if (route.children) {
                    const defaultChildPath = findDefaultRoute(route.children);
                    const defaultPath = `${fullPath}/${defaultChildPath}`.replace(/\/+/g, '/');

                    return (
                        <li key={idx} className="mb-2" id={`route-${fullPath}`}>
                            <div className="flex justify-between items-center w-full">
                                <div
                                    className="flex justify-start items-center w-full"
                                    title={`Go to ${formatRouteName(route.path || '')}`}>
                                    {RouteIcons[route.path ?? '']
                                        ? RouteIcons[route.path ?? '']
                                        : null}
                                    <button
                                        className={`flex-grow text-left p-2 rounded-lg transition font-medium responsive-text ${
                                            isRouteHighlighted(fullPath, route.path)
                                                ? 'bg-blue-500 text-white'
                                                : 'hover:bg-gray-700'
                                        }`}
                                        onClick={() => {
                                            if (defaultChildPath) {
                                                navigate(defaultPath);
                                            }
                                            toggleDropdown(fullPath);
                                        }}>
                                        {formatRouteName(route.path || '', currentWorkspace?.name)}
                                    </button>
                                </div>
                                <button
                                    className="p-2 text-gray-400 hover:text-white transition-transform transform duration-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDropdown(fullPath);
                                    }}>
                                    <span
                                        className={`inline-block transform transition-transform duration-300 ease-in-out ${
                                            openDropdowns.has(fullPath) ? '-rotate-180' : 'rotate-0'
                                        }`}>
                                        ▼
                                    </span>
                                </button>
                            </div>
                            <ul
                                className={`ml-2 lg:ml-4 border-l border-gray-700 pl-2 mt-2 transition-all duration-300 overflow-hidden ${
                                    openDropdowns.has(fullPath) ? '' : 'max-h-0'
                                }`}>
                                {renderRoutes(route.children, fullPath)}
                            </ul>
                        </li>
                    );
                }

                return (
                    <li
                        key={idx}
                        id={`route-${fullPath}`}
                        className="mb-2"
                        title={`Go to ${formatRouteName(route.path || '')}`}>
                        <Link
                            to={fullPath}
                            state={{ from: location.pathname }}
                            className={`p-2 rounded-lg transition font-medium flex justify-start items-center gap-x-2 responsive-text ${
                                isRouteHighlighted(fullPath)
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-700'
                            }`}>
                            {RouteIcons[route.path ?? ''] ? RouteIcons[route.path ?? ''] : null}
                            {formatRouteName(route.path || 'Home')}
                        </Link>
                    </li>
                );
            });
    };

    return (
        <div
            className={`fixed h-screen bg-gray-800 text-white shadow-lg transition-all duration-300 flex ${
                isCollapsed ? 'min-w-12 lg:min-w-16' : 'max-w-48 lg:max-w-64'
            }`}>
            <div
                className={`flex flex-col justify-between ${isCollapsed ? 'max-w-0 hidden' : 'max-w-36 lg:max-w-48'}`}>
                {/* Left Section: Collapsible Navigation */}
                <div className={`flex-1 overflow-hidden`}>
                    <nav className="h-full overflow-y-auto">
                        <ul className="p-2 lg:p-4">{renderRoutes(routes)}</ul>
                    </nav>
                </div>

                <div className="p-2 lg:p-4 border-t-2 border-gray-500">
                    <div
                        className="relative cursor-pointer"
                        tabIndex={0}
                        onClick={() => setUserDropdownVisible((prev) => !prev)}
                        onBlur={() => setUserDropdownVisible(false)}>
                        {user?.picture && (
                            <>
                                <div className="flex justify-center items-center">
                                    <img
                                        src={user.picture}
                                        alt="User Profile"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                            const currentImg = e.currentTarget;
                                            if (!currentImg.src.includes('/default-user.png')) {
                                                currentImg.src = '/default-user.png';
                                            }
                                        }}
                                        className="w-6 lg:w-10 h-6 lg:h-10 rounded-full border-2 border-gray-300"
                                    />
                                    <span className="m-2 overflow-wrap max-w-28  responsive-text">
                                        {user.name}
                                    </span>
                                </div>
                                {userDropdownVisible && (
                                    <div className="absolute left-0 bottom-full mb-2 w-40 bg-white rounded-md shadow-lg z-10">
                                        <ul className="text-gray-800  responsive-text">
                                            <li
                                                className="px-4 py-2 border-b"
                                                onClick={() =>
                                                    navigate(SHARED_ROUTES.AUTHENTICATED_SETTINGS, {
                                                        state: {
                                                            from: `${location.pathname}${location.search}`
                                                        }
                                                    })
                                                }>
                                                Settings
                                            </li>
                                            <li
                                                className="hover:bg-gray-100 rounded-b-md px-4 py-2 cursor-pointer"
                                                onClick={() => logout()}>
                                                Logout
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Section: Collapse Button (Always Visible) */}
            <div className="min-w-12 lg:min-w-16 flex justify-center items-center bg-gray-900">
                <button
                    onClick={onToggleCollapse}
                    className="text-white p-2 lg:p-3 rounded-full bg-blue-500 hover:bg-blue-700 transition-transform">
                    <p
                        title={isCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
                        className={`text:base lg:text-2xl transform transition-transform ${
                            isCollapsed ? 'rotate-180' : 'rotate-0'
                        }`}>
                        ◀
                    </p>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
