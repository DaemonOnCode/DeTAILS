/** @type {import("tailwindcss").Config} */
module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    darkMode: 'media',
    plugins: [require('tailwind-scrollbar')],
    variants: {
        extend: {
            scrollbar: ['group-hover'] // Enable group-hover for scrollbar styles
        }
    },
    theme: {
        extend: {
            keyframes: {
                shadowPulse: {
                    '0%, 100%': { boxShadow: '0 10px 30px rgba(59, 130, 246, 0.6)' },
                    '50%': { boxShadow: '0 15px 40px rgba(59, 130, 246, 0.8)' }
                }
            },
            animation: {
                shadowPulse: 'shadowPulse 1.5s ease-in-out infinite'
            },
            height: {
                panel: 'calc(100vh - 64px - 48px)',
                page: 'calc(100vh - 48px)',
                maxPageContent: 'calc(100vh - 7rem)'
            },
            minHeight: {
                panel: 'calc(100vh - 64px - 48px)',
                page: 'calc(100vh - 48px)',
                maxPageContent: 'calc(100vh - 7rem)',
                '1/2': '50%',
                '2/5': '40%'
            },
            maxHeight: {
                panel: 'calc(100vh - 64px - 48px)',
                page: 'calc(100vh - 48px)',
                maxPageContent: 'calc(100vh - 7rem)',
                '1/2': '50%',
                '2/5': '40%'
            }
        }
    }
};
