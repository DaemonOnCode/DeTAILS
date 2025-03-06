const { spawn } = require('child_process');
const config = require('./global-state');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { electronLogger } = require('./electron-logger');

const spawnedProcesses = [];

// Configuration for services
const servicesConfig = (executablesPath) => {
    return {
        chroma: {
            name: 'chroma',
            folder: path.join(executablesPath, 'chroma'),
            command: './cli',
            args: ['run']
        },
        backend: {
            name: 'backend',
            folder: path.join(executablesPath, 'data-modeling-server'),
            command: './main',
            args: []
        },
        // miscFrontend: {
        //     name: 'miscFrontend',
        //     folder: path.join(__dirname, '..', '..', '..', 'log-viewer'),
        //     command: 'npm',
        //     args: ['run', 'local']
        // },
        ollama: {
            name: 'ollama',
            folder: path.join(executablesPath, 'ollama'),
            command: './ollama-darwin',
            args: ['serve']
        }
    };
};

// Helper function to spawn a process
const spawnService = async (config, globalCtx) => {
    return new Promise((resolve, reject) => {
        electronLogger.log(`Starting ${config.name}...`);
        const extraConfig = {
            cwd: config.folder,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        };
        const service = spawn(config.command, config.args, extraConfig);

        spawnedProcesses.push({ name: config.name, process: service });

        if (service.stdout) {
            service.stdout.on('data', (data) => {
                electronLogger.log(`[${config.name} stdout]: ${data.toString()}`);
            });
        }

        // Capture stderr
        if (service.stderr) {
            service.stderr.on('data', (data) => {
                electronLogger.error(`[${config.name} stderr]: ${data.toString()}`);
            });
        }

        service.on('spawn', (data) => {
            electronLogger.log(`Spawned ${config.name}`);
            globalCtx.getState().mainWindow.webContents.send('service-started', config.name);
        });

        service.on('exit', (code) => {
            electronLogger.log(`${config.name} exited with code ${code}`);
            try {
                globalCtx.getState().mainWindow.webContents.send('service-stopped', config.name);
            } catch (e) {
                electronLogger.log(e);
            }
            if (code === 0) {
                resolve();
            } else {
                if (config.name === 'backend' && code !== 0) {
                    electronLogger.log(
                        `The ${config.name} service may have failed due to port issues. Please check.`
                    );
                    resolve(); // Resolve without rejecting
                } else {
                    reject(new Error(`${config.name} exited with code ${code}`));
                }
            }
        });

        service.on('error', (err) => {
            electronLogger.error(`${config.name} encountered an error:`, err);
            globalCtx.getState().mainWindow.webContents.send('service-stopped', config.name);
            if (config.name === 'backend' && err.message.includes('Address already in use')) {
                electronLogger.log(
                    `The ${config.name} service failed to start due to port conflict.`
                );
                resolve(); // Graceful resolution
            } else {
                reject(err);
            }
        });

        service.on('disconnect', (code) => {
            electronLogger.log(`${config.name} disconnected with code ${code}`);
            // globalCtx.getState().mainWindow.webContents.send('service-stopped', config.name);
            reject(new Error(`${config.name} disconnected with code ${code}`));
        });
    });
};

// Define resource paths per OS
const osResourcePaths = Object.freeze({
    WIN32: path.join(app.getPath('appData'), 'DeTAILS', 'executables'),
    DARWIN: path.join(
        app.getPath('home'),
        'Library',
        'Application Support',
        'DeTAILS',
        'executables'
    ),
    LINUX: path.join(app.getPath('home'), '.config', 'DeTAILS', 'executables')
});

// Function to copy binaries only if they do not exist
const copyBinariesIfNotExists = (resourceBinariesPath, binariesPath) => {
    if (!fs.existsSync(resourceBinariesPath)) {
        electronLogger.log('No binaries found in process.resourcesPath.');
        return;
    }

    if (!fs.existsSync(binariesPath)) {
        fs.mkdirSync(binariesPath, { recursive: true }); // Ensure destination exists
    }

    const copyMissingFilesRecursively = (src, dest) => {
        const items = fs.readdirSync(src, { withFileTypes: true });

        items.forEach((item) => {
            const srcPath = path.join(src, item.name);
            const destPath = path.join(dest, item.name);

            if (item.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                copyMissingFilesRecursively(srcPath, destPath);
            } else {
                if (!fs.existsSync(destPath)) {
                    try {
                        fs.copyFileSync(srcPath, destPath);
                        electronLogger.log(`Copied missing file: ${destPath}`);
                    } catch (error) {
                        electronLogger.error(`Error copying file ${destPath}: ${error.message}`);
                    }
                } else {
                    electronLogger.log(`Skipped existing file: ${destPath}`);
                }
            }
        });
    };

    copyMissingFilesRecursively(resourceBinariesPath, binariesPath);
    electronLogger.log(`Binaries verification completed at: ${binariesPath}`);
};

// Function to spawn all services
const spawnServices = async (globalCtx) => {
    // process.resourcesPath;
    // Get current platform and corresponding binaries path
    const platform = process.platform.toUpperCase(); // win32 -> WIN32, darwin -> DARWIN, linux -> LINUX
    const binariesPath = osResourcePaths[platform];

    // Ensure the binaries directory exists
    if (!fs.existsSync(binariesPath)) {
        fs.mkdirSync(binariesPath, { recursive: true });
    }

    // Get the path to packaged binaries
    const resourceBinariesPath = path.join(process.resourcesPath, 'executables');

    copyBinariesIfNotExists(resourceBinariesPath, binariesPath);

    const executablesPath =
        process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '..', '..', '..', 'executables')
            : resourceBinariesPath;
    const serviceConfig = servicesConfig(executablesPath);

    if (spawnedProcesses.length > 0) {
        electronLogger.log('Services already started.');
        globalCtx.getState().mainWindow.webContents.send('service-started', 'all');
        return;
    }

    try {
        await Promise.all([
            spawnService(serviceConfig.chroma, globalCtx),
            spawnService(serviceConfig.backend, globalCtx),
            spawnService(serviceConfig.ollama, globalCtx)
            // spawnService(serviceConfig.miscFrontend, globalCtx)
        ]);
        electronLogger.log('All services started successfully.');
    } catch (error) {
        electronLogger.error('Error starting services:', error);
    }
};

module.exports = { spawnServices, spawnedProcesses };
