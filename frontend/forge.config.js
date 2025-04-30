const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

const extraResourcePath =
    process.platform === 'win32'
        ? path.resolve(__dirname, '..', 'executables_windows')
        : process.platform === 'darwin'
          ? path.resolve(__dirname, '..', 'executables_mac')
          : path.resolve(__dirname, '..', 'executables_linux');

module.exports = {
    hooks: {
        prePackage: () => {
            console.log('Cleaning old builds...');
            const outDir = path.join(__dirname, 'out');
            const makeDir = path.join(__dirname, 'make');
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
            if (fs.existsSync(makeDir)) {
                fs.rmSync(makeDir, { recursive: true, force: true });
            }
        }
    },
    packagerConfig: {
        name: 'DeTAILS',
        asar: {
            unpack: '**/*.worker.js'
        },
        appCategoryType: 'public.app-category.developer-tools',
        icon: 'public/details-icon',
        extraResource: [extraResourcePath]
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                setupIcon: 'public/favicon.ico',
                iconUrl: `file://${path.resolve(__dirname, 'public', 'favicon.ico')}`
            }
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'linux', 'win32']
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                format: 'ULFO',
                icon: 'public/details-icon.icns',
                overwrite: true,
                additionalDMGOptions: {
                    icon: 'public/details-icon.icns'
                }
            }
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
                options: {
                    maintainer: 'Ansh Sharma',
                    categories: ['Utility'],
                    icon: 'public/details-icon.png',
                    section: 'utility'
                }
            }
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {
                options: {
                    summary: 'DeTAILS',
                    description: 'A developer tool for CTA',
                    license: 'MIT',
                    group: 'Development',
                    icon: 'public/details-icon.png'
                }
            }
        }
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {}
        },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true
        })
    ]
};
