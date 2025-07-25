# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['cli.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../migrations/embeddings_queue', 'chromadb/migrations/embeddings_queue'),
        ('../migrations/sysdb', 'chromadb/migrations/sysdb'),
        ('../migrations/metadb', 'chromadb/migrations/metadb'),
        ('../log_config.yml', 'log_config.yml'),
    ],
    hiddenimports=[
        'sqlite3',
        'chromadb.app',
        'importlib_resources.trees',
        'chromadb.utils.embedding_functions',  # Include the entire module
        'chromadb.api.segment',
        'chromadb.db.impl',
        'chromadb.segment.impl.metadata',
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
        'chromadb.segment.impl.metadata.sqlite'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='cli',
    debug=True,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=['*.dylib'],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
