import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function ErrorBoundary() {
    const error = useRouteError();

    console.log('Error:', error);

    if (isRouteErrorResponse(error)) {
        return (
            <div className="h-screen w-screen flex flex-col justify-center items-center">
                <h1>
                    {error.status} {error.statusText}
                </h1>
                <p>{error.data}</p>
                <p
                    className="text-blue-600 underline cursor-pointer"
                    onClick={() => window.location.reload()}>
                    Reload
                </p>
            </div>
        );
    } else if (error instanceof Error) {
        return (
            <div className="h-screen w-screen flex flex-col justify-center items-center">
                <h1>Error</h1>
                <p>{error.message}</p>
                <p>The stack trace is:</p>
                <pre>{error.stack}</pre>
                <p
                    className="text-blue-600 underline cursor-pointer"
                    onClick={() => window.location.reload()}>
                    Reload
                </p>
            </div>
        );
    } else {
        return <h1>Unknown Error</h1>;
    }
}
