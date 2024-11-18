const { exec } = require('child_process');
const path = require('path');

exports.executeOllama = async (app) => {
    const ollamaPath = path.resolve(__dirname, '..', '..', '..', 'ollama-0.4.2');

    const escapedPath = `"${ollamaPath}"`;
    const ollamaExecutable = './dist/ollama-darwin';

    const model = 'llama3.2:3b';
    // Start the Ollama server
    const ollamaProcess = exec(
        `cd ${escapedPath} && ${ollamaExecutable} serve`,
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Ollama failed to start: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Ollama server stderr: ${stderr}`);
            }
            console.log(`Ollama server stdout: ${stdout}`);
        }
    );

    ollamaProcess.stdout.on('data', (data) => {
        console.log(`Ollama stdout: ${data}`);
    });

    // Cleanup on app close
    app.on('before-quit', () => {
        if (ollamaProcess) {
            ollamaProcess.kill(); // Terminate the Ollama server
        }
    });
};
