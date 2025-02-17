import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<{ children?: ReactNode }, ErrorBoundaryState> {
    constructor(props: { children?: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.log('Error boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError && this.state.error) {
            return (
                <div className="p-4 bg-[#ffe6e6] h-screen w-screen flex flex-col justify-center items-center">
                    <h2>Something went wrong.</h2>
                    <p>{this.state.error.message}</p>
                    <p
                        className="text-blue-600 underline cursor-pointer"
                        onClick={() => window.location.reload()}>
                        Go back
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
