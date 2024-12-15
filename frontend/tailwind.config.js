/** @type {import("tailwindcss").Config} */
module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    darkMode: 'media',
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
            }
        }
    }
};
