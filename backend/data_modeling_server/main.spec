# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

# Use sys.argv[0] to get the spec file's path
base_path = os.path.dirname(sys.argv[0])  # Directory where the .spec file is located
if os.name == "nt":  # Windows
    model_path = os.path.join(base_path, "./winenv/Lib/site-packages/en_core_web_sm/en_core_web_sm-3.8.0")
elif sys.platform == "darwin": # MacOS
    model_path = os.path.join(base_path, "./.venv/lib/python3.11/site-packages/en_core_web_sm/en_core_web_sm-3.8.0")
else:
    model_path = os.path.expanduser("./linenv/lib/python3.12/site-packages/en_core_web_sm/en_core_web_sm-3.8.0")

a = Analysis(
    ['main.py'],
    pathex=[base_path],
    binaries=[],
    datas=[(model_path, 'spacy/data/en_core_web_sm')],
    hiddenimports=[
        'main',
        'routes',
        'utils',
        'chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2',
        'chromadb.telemetry.product.posthog',
        'pydantic.deprecated.decorator',
        'transmission_rpc',
        'chromadb.api.fastapi'
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
    name='main',
    debug=True,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
