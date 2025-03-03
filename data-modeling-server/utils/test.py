import os
import re
import json
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader

def load_document(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        loader = PyPDFLoader(file_path)
    elif ext == '.docx':
        loader = Docx2txtLoader(file_path)
    elif ext == '.txt':
        loader = TextLoader(file_path)
    else:
        raise ValueError("Unsupported file extension: " + ext)
    
    # Each loader's load() method returns a list of Document objects with 'page_content'
    docs = loader.load()
    return "\n".join(doc.page_content for doc in docs)

# Updated regex pattern:
# 1. Match a timestamp line: "0:0:0.0 --> 0:0:13.210"
# 2. Then the speaker line
# 3. Then capture all lines (including blank ones) until a newline followed by a new timestamp or end-of-file.
pattern = re.compile(
    r'(?P<start>\d+:\d+:\d+(?:\.\d+)?)\s*-->\s*(?P<end>\d+:\d+:\d+(?:\.\d+)?)\s*\n'  # timestamp line
    r'(?P<speaker>.+?)\n'                                                            # speaker line
    r'(?P<text>(?:.*(?:\n|$))+(?=\n\d+:\d+:\d+(?:\.\d+)?\s*-->\s*\d+:\d+:\d+(?:\.\d+)?|\Z))',
    re.DOTALL
)

# Set your file path (update this path as needed)
file_path = '/Users/anshsharma/Downloads/P2_Interview.docx'

# Load the document text using the appropriate loader
data = load_document(file_path)
# Uncomment the next line if you want to check the raw data:
# print(data)

results = []
for match in pattern.finditer(data):
    entry = {
        "start": match.group("start").strip(),
        "end": match.group("end").strip(),
        "speaker": match.group("speaker").strip(),
        "text": match.group("text").strip()
    }
    results.append(entry)

# Output the parsed segments as formatted JSON
print(json.dumps(results, indent=2))
