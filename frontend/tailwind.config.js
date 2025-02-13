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
            cursor: {
                pencil: "url('data:image/svg+xml;charset=utf-8,%3Csvg%20stroke%3D%22currentColor%22%20fill%3D%22currentColor%22%20stroke-width%3D%220%22%20viewBox%3D%220%200%20512%20512%22%20height%3D%2232px%22%20width%3D%2232px%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%2232%22%20d%3D%22M364.13%20125.25%2087%20403l-23%2045%2044.99-23%20277.76-277.13-22.62-22.62zm56.56-56.56-22.62%2022.62%2022.62%2022.63%2022.62-22.63a16%2016%200%200%200%200-22.62h0a16%2016%200%200%200-22.62%200z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E') 8 8, auto"
            },
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
    },
    variants: {
        extend: {
            cursor: ['hover'] // Enable the hover variant for cursor
        }
    }
};
