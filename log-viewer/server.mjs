import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 4000;

// Resolve directory paths properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from React's build folder
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all route to serve React's index.html for frontend routing
app.get('*', (req, res) => {
    console.log('Serving', req.url);
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
