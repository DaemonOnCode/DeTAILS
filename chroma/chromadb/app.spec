# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Collect all submodules and data files of chromadb
hiddenimports = collect_submodules('chromadb')
datas = collect_data_files('chromadb')


binaries = [
    ('/Library/Frameworks/Python.framework/Versions/3.13/lib/libpython3.13.dylib', 'libpython3.13.dylib')
]

a = Analysis(
    ['app.py'],
    pathex=[],  # Add the path to your project if needed
    binaries=binaries,
    # datas=datas,
    # hiddenimports=hiddenimports,
    datas=[
        ('./migrations/embeddings_queue', 'chromadb/migrations/embeddings_queue'),
        ('./migrations/sysdb', 'chromadb/migrations/sysdb'),
        ('./migrations/metadb', 'chromadb/migrations/metadb'),
        ('./log_config.yml', 'log_config.yml'),
    ],
    hiddenimports=[
        'importlib_resources.trees',
        'chromadb.utils.embedding_functions',  # Inclxude the entire module
        'chromadb.api.segment',
        'chromadb.db.impl',
        'chromadb.db.impl.sqlite',
        'chromadb.migrations',
        'chromadb.migrations.embeddings_queue',
        'chromadb.migrations.sysdb',
        'chromadb.migrations.metadb',
        'chromadb.segment.impl.manager',
        'chromadb.segment.impl.manager.local',
        'chromadb.execution.executor.local',
        'chromadb.quota.simple_quota_enforcer',
        'chromadb.telemetry.product.posthog',
        'chromadb.rate_limit.simple_rate_limit',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='app',
    debug=True,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
