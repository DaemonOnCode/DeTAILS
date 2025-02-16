const { ipcMain } = require('electron');
const { electronLogger } = require('./electron-logger');

// 🟢 Scoped Contexts Storage
const contexts = {};

// 🟢 Function to Create a New Context
const createContext = (contextName, initialState = {}) => {
    contexts[contextName] = { ...initialState };
    const subscribers = [];

    electronLogger.log(`✅ Electron Context "${contextName}" created.`);

    ipcMain.handle(`getContext_${contextName}`, () => contexts[contextName]);

    ipcMain.on(`updateContext_${contextName}`, (event, newState) => {
        contexts[contextName] = { ...contexts[contextName], ...newState };
        event.sender.send(`contextUpdated_${contextName}`, contexts[contextName]); // Notify listeners
    });

    // Object.keys(handlers).forEach((handlerName) => {
    //     ipcMain.handle(`${contextName}_${handlerName}`, async (event, ...args) => {
    //         return await handlers[handlerName](contexts[contextName].state, ...args);
    //     });
    // });
    return {
        name: contextName,
        getState: () => contexts[contextName],
        setState: (newState) => {
            contexts[contextName] = { ...contexts[contextName], ...newState };
            subscribers.forEach((callback) => callback(contexts[contextName]));
        },
        subscribe: (callback) => {
            // console.log('Subscribing to context', contextName);
            subscribers.push(callback);
            ipcMain.on(`contextUpdated_${contextName}`, (event, state) => callback(state));
            //  Unsubscribe
            return () => {
                const index = subscribers.indexOf(callback);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
            };
        },
        resetContext: () => {
            contexts[contextName] = { ...initialState };
        }
    };
};

const findContextByName = (contextName, ctxs) => {
    // electronLogger.log(`🔍 Finding context "${contextName}"`, ctxs);
    return ctxs.find((ctx) => ctx.name === contextName);
};

// Export Functions
module.exports = { createContext, findContextByName };
