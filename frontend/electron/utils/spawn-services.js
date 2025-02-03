const { spawn } = require('child_process');
const path = require('path');
const config = require('./global-state');

const spawnedProcesses = [];

// Configuration for services
const servicesConfig = {
    chroma: {
        name: 'chroma',
        folder: path.join(__dirname, '..', '..', '..', 'executables', 'chroma'),
        command: './cli',
        args: ['run']
    },
    backend: {
        name: 'backend',
        folder: path.join(__dirname, '..', '..', '..', 'executables', 'data-modeling-server'),
        command: './main',
        args: []
    },
    miscFrontend: {
        name: 'miscFrontend',
        folder: path.join(__dirname, '..', '..', '..', 'log-viewer'),
        command: 'npm',
        args: ['run', 'local']
    },
    ollama: {
        name: 'ollama',
        folder: path.join(__dirname, '..', '..', '..', 'executables', 'ollama'),
        command: './ollama-darwin',
        args: ['serve']
    }
};

// Helper function to spawn a process
const spawnService = async (config, mainWindow) => {
    return new Promise((resolve, reject) => {
        console.log(`Starting ${config.name}...`);
        const extraConfig = {
            cwd: config.folder,
            shell: true,
            stdio: 'inherit'
        };
        const service = spawn(config.command, config.args, extraConfig);

        spawnedProcesses.push({ name: config.name, process: service });

        service.on('spawn', (data) => {
            console.log(`Spawned ${config.name}`);
            mainWindow.webContents.send('service-started', config.name);
        });

        service.on('exit', (code) => {
            console.log(`${config.name} exited with code ${code}`);
            try {
                mainWindow.webContents.send('service-stopped', config.name);
            } catch (e) {
                console.log(e);
            }
            if (code === 0) {
                resolve();
            } else {
                if (config.name === 'backend' && code !== 0) {
                    console.log(
                        `The ${config.name} service may have failed due to port issues. Please check.`
                    );
                    resolve(); // Resolve without rejecting
                } else {
                    reject(new Error(`${config.name} exited with code ${code}`));
                }
            }
        });

        service.on('error', (err) => {
            console.error(`${config.name} encountered an error:`, err);
            mainWindow.webContents.send('service-stopped', config.name);
            if (config.name === 'backend' && err.message.includes('Address already in use')) {
                console.log(`The ${config.name} service failed to start due to port conflict.`);
                resolve(); // Graceful resolution
            } else {
                reject(err);
            }
        });

        service.on('disconnect', (code) => {
            console.log(`${config.name} disconnected with code ${code}`);
            // mainWindow.webContents.send('service-stopped', config.name);
            reject(new Error(`${config.name} disconnected with code ${code}`));
        });
    });
};

// Function to spawn all services
const spawnServices = async (globalCtx) => {
    try {
        await Promise.all([
            spawnService(servicesConfig.chroma, globalCtx.getState().mainWindow),
            spawnService(servicesConfig.backend, globalCtx.getState().mainWindow),
            spawnService(servicesConfig.miscFrontend, globalCtx.getState().mainWindow),
            spawnService(servicesConfig.ollama, globalCtx.getState().mainWindow)
        ]);
        console.log('All services started successfully.');
    } catch (error) {
        console.error('Error starting services:', error);
    }
};

module.exports = { spawnServices, spawnedProcesses };
