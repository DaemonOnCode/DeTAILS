import json
import time
from fastapi.responses import JSONResponse
import httpx
import requests
from fastapi import APIRouter, Depends, HTTPException, Body
from bs4 import BeautifulSoup
import re

from constants import OLLAMA_API_BASE
from errors.ollama_errors import DeleteModelError, InvalidModelError, PullModelError
from errors.request_errors import RequestError
from headers.app_id import get_app_id
from ipc import send_ipc_message
from routes.websocket_routes import manager

router = APIRouter(dependencies=[Depends(get_app_id)])

@router.get("/list-models")
def list_local_models():
    resp = requests.get(f"{OLLAMA_API_BASE}/api/tags")
    resp.raise_for_status()
    return resp.json()
    
    

@router.delete("/delete-model")
def delete_model(payload: dict = Body(...)):
    try:
        resp = requests.delete(f"{OLLAMA_API_BASE}/api/delete", json=payload)
        if resp.status_code == 404:
            return JSONResponse(status_code=200, content={"message": "Model not found."})
        resp.raise_for_status()
        if not resp.text.strip():
            return {"message": "Model deleted successfully."}
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise DeleteModelError(f"Error deleting model: {e}")

@router.post("/pull-model")
async def pull_model(
    payload: dict = Body(...),
    app_id: str = Depends(get_app_id)
):
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{OLLAMA_API_BASE}/api/pull", json=payload) as response:
                if response.status_code == 404:
                    raise RequestError(status_code=404, message="Model not found.")
                response.raise_for_status()
                last_sent = time.monotonic()
                interval = 1.0
                sent_any = False
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    sent_any = True
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    print(f"Received line: {line}")
                    if "error" in data:
                        raise RequestError(status_code=412, message=data["error"])
                    current_time = time.monotonic()
                    if current_time - last_sent >= interval:
                        await send_ipc_message(app_id, line)
                        last_sent = current_time
                if not sent_any:
                    raise RequestError(status_code=404, message="Model not found.")
        return {"message": "Model pulled successfully."}
    except RequestError:
        raise
    except Exception as e:
        raise RequestError(status_code=500, message=f"Error pulling model: {e}")

def parse_size(size_str: str) -> float:
    size_str = size_str.strip().upper()
    match = re.match(r"([\d\.]+)([A-Z]+)", size_str)
    if not match:
        return 0.0
    number, unit = match.groups()
    number = float(number)
    if unit == "GB":
        return number
    elif unit == "MB":
        return number / 1024
    elif unit == "KB":
        return number / (1024 * 1024)
    else:
        return number

@router.get("/model-metadata/{model_name}")
def get_model_metadata(model_name: str):
    url = f"https://ollama.com/library/{model_name}/tags"
    resp = requests.get(url)

    if resp.status_code == 404:
        raise InvalidModelError(f"Model '{model_name}' not found.")
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    page_text = soup.get_text(" ", strip=True)

    name_elem = soup.find("a", attrs={"x-test-model-name": True})
    desc_elem = soup.find("span", id="summary-content")
    main_model = {
        "name": (name_elem.get_text(strip=True) if name_elem else "").strip(),
        "description": (desc_elem.get_text(strip=True) if desc_elem else "").strip(),
    }
    
    if model_name not in page_text:
        raise RequestError(500, message="Model name not found in page text.")
    
    lines = page_text.splitlines()
    for line in lines:
        if (len(line) > 50 and
            not re.search(r"\d+\.\d+\s*(GB|MB)", line) and  
            not re.search(r"\b[0-9a-f]{6,}\b", line) and 
            not re.search(r"\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago", line)):
            main_model["description"] = line.strip()
            break

    tags = []
    tag_pattern = rf"{re.escape(model_name)}:(\S+)" 
    size_pattern = r"(\d+\.\d+\s*(GB|MB)|\d+\s*(GB|MB))"
    hash_pattern = r"\b([0-9a-f]{6,})\b"
    updated_pattern = r"(\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago)"

    potential_entries = page_text.split()
    seen_tags = set()
    current_tag = {}
    i = 0
    while i < len(potential_entries):
        word = potential_entries[i]

        tag_match = re.match(tag_pattern, word)
        if tag_match:
            tag = tag_match.group(1)
            if tag not in seen_tags:
                if current_tag:
                    tags.append(current_tag)
                current_tag = {"tag": tag, "size": "", "hash": "", "updated": ""}
                seen_tags.add(tag)
            i += 1
            continue

        if current_tag:
            if re.match(size_pattern, word):
                current_tag["size"] = word
            elif re.match(hash_pattern, word):
                current_tag["hash"] = word
            elif re.match(updated_pattern, " ".join(potential_entries[i:i+3])):
                current_tag["updated"] = " ".join(potential_entries[i:i+3])
                i += 2  
        i += 1

    if current_tag:
        tags.append(current_tag)

    if not tags:
        raise RequestError(500, message="No tags found — page format likely changed.")

    return {
        "main_model": main_model,
        "tags": tags
    }