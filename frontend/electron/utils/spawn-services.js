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
    const isWindows = process.platform === 'win32';
    const isDarwin = process.platform === 'darwin';
    return {
        chroma: {
            name: 'chroma',
            folder: path.join(executablesPath, 'chroma'),
            command: isWindows ? 'cli.exe' : './cli',
            args: ['run']
        },
        backend: {
            name: 'backend',
            folder: path.join(executablesPath, 'data-modeling-server'),
            command: isWindows ? 'main.exe' : './main',
            args: [],
            env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
        },
        ollama: {
            name: 'ollama',
            folder: path.join(executablesPath, 'ollama'),
            command: isWindows ? 'ollama.exe' : isDarwin ? './ollama-darwin' : './ollama',
            args: ['serve']
        }
    };
};

const spawnService = async (config, globalCtx) => {
    const isWindows = process.platform === 'win32';
    return new Promise((resolve, reject) => {
        electronLogger.log(`Starting ${config.name}...`);
        const extraConfig = {
            cwd: config.folder,
            shell: !isWindows,
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: config.env ?? process.env
        };
        const service = spawn(config.command, config.args, extraConfig);

        spawnedProcesses.push({ name: config.name, process: service });

        if (service.stdout) {
            service.stdout.on('data', (data) => {
                electronLogger.log(`[${config.name} stdout]: ${data.toString()}`);
            });
        }

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
                    resolve();
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
                resolve();
            } else {
                reject(err);
            }
        });

        service.on('disconnect', (code) => {
            electronLogger.log(`${config.name} disconnected with code ${code}`);
            reject(new Error(`${config.name} disconnected with code ${code}`));
        });
    });
};

const osResourcePaths = Object.freeze({
    WIN32: path.join(app.getPath('appData'), 'DeTAILS', 'executables'),
    DARWIN: path.join(
        app.getPath('home'),
        'Library',
        'Application Support',
        'DeTAILS',
        'executables'
    ),
    LINUX: path.join(app.getPath('home'), '.config', 'details', 'executables')
});

// Function to copy binaries only if they do not exist
const copyBinariesIfNotExists = (resourceBinariesPath, binariesPath) => {
    if (!fs.existsSync(resourceBinariesPath)) {
        electronLogger.log('No binaries found in process.resourcesPath.');
        return;
    }

    if (!fs.existsSync(binariesPath)) {
        fs.mkdirSync(binariesPath, { recursive: true });
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

const spawnServices = async (globalCtx) => {
    const platform = process.platform.toUpperCase();
    const binariesPath = osResourcePaths[platform];

    if (!fs.existsSync(binariesPath)) {
        fs.mkdirSync(binariesPath, { recursive: true });
    }

    let resourceBinariesPath = '';
    if (process.platform === 'win32') {
        resourceBinariesPath = path.join(process.resourcesPath, 'executables_windows');
    } else if (process.platform === 'darwin') {
        resourceBinariesPath = path.join(process.resourcesPath, 'executables_mac');
    } else if (process.platform === 'linux') {
        resourceBinariesPath = path.join(process.resourcesPath, 'executables_linux');
    }

    copyBinariesIfNotExists(resourceBinariesPath, binariesPath);

    const executablesPath = binariesPath;
    const serviceConfig = servicesConfig(executablesPath);

    if (spawnedProcesses.length > 0) {
        electronLogger.log('Services already started.');
        for (const service of spawnedProcesses) {
            electronLogger.log(`Service ${service.name} is already running.`);
            globalCtx.getState().mainWindow.webContents.send('service-started', service.name);
        }
        return;
    }

    try {
        await Promise.all([
            spawnService(serviceConfig.chroma, globalCtx),
            spawnService(serviceConfig.backend, globalCtx),
            spawnService(serviceConfig.ollama, globalCtx)
        ]);
        electronLogger.log('All services started successfully.');
    } catch (error) {
        electronLogger.error('Error starting services:', error);
    }
};

module.exports = { spawnServices, spawnedProcesses };
