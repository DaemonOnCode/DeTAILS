function OAuthRedirectPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-500 to-blue-500 text-white">
            <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center max-w-md text-center">
                <div className="mb-4">
                    <svg
                        className="w-16 h-16 text-green-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-2">Login Successful!</h1>

                <p className="text-gray-600 mb-6">
                    You can now safely close this tab and return to the app.
                </p>
            </div>
        </div>
    );
}

export default OAuthRedirectPage;
