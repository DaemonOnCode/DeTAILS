## 1. Build Ollama (https://github.com/ollama/ollama/blob/main/docs/development.md)
 - cd ollama-0.4.2
 - ./scripts/build.sh 0.4.2

(Optional)
### Run Ollama
 - (build ollama)
 - ./ollama serve

## 2. Build Chroma db
 - cd chroma
 - python3 -m venv env
 - source ./env/bin/activate
 - pip install requirements_exe.txt
 - cd chromadb/cli
 - python3 -m PyInstaller --log-level=DEBUG cli.spec && ./dist/cli run
(3.13)

(Optional)
 ### Run Chroma db
 - cd chroma
 - source ./env/bin/activate
 - python3 -m chromadb.cli.cli run


## 3. Copy into executables folder
 - cd executables
 (Optional; Only if script doesnt have executing permissions)
 - chmod -R +x ./
 - ./get.sh

 ## 4. Run Electron+React
 - cd frontend
 - npm i 
 <br>OR
 - npm install
 - npm run dev