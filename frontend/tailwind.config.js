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
                pencil: 'url("data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%233b82f6%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M11%204H4a2%202%200%200%200-2%202v14a2%202%200%200%200%202%202h14a2%202%200%200%200%202-2v-7%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M18.5%202.5a2.121%202.121%200%200%201%203%203L12%2015l-4%201%201-4%209.5-9.5z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E") 8 8, auto'
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
                panel: 'var(--panel-height)',
                page: 'var(--page-height)',
                maxPageContent: 'var(--max-page-content-height)'
            },
            minHeight: {
                panel: 'var(--panel-height)',
                page: 'var(--page-height)',
                maxPageContent: 'var(--max-page-content-height)',
                '1/2': '50%',
                '2/5': '40%',
                '3/5': '60%'
            },
            maxHeight: {
                panel: 'var(--panel-height)',
                page: 'var(--page-height)',
                maxPageContent: 'var(--max-page-content-height)',
                '1/2': '50%',
                '2/5': '40%',
                '3/5': '60%'
            }
        }
    },
    variants: {
        extend: {
            cursor: ['hover'] // Enable the hover variant for cursor
        }
    }
};
