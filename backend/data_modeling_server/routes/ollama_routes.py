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

    name_elem = soup.find("a", attrs={"x-test-model-name": True})
    desc_elem = soup.find("span", id="summary-content")
    main_model = {
        "name": (name_elem.get_text(strip=True) if name_elem else "").strip(),
        "description": (desc_elem.get_text(strip=True) if desc_elem else "").strip(),
    }

    ul = None
    for candidate in soup.find_all("ul"):
        if candidate.find("a", href=re.compile(rf"^/library/{re.escape(model_name)}:")):
            ul = candidate
            break
    if ul is None:
        raise RequestError(500, message="Could not locate versions list on Ollama page.")

    tags = []
    for li in ul.find_all("li", recursive=False):
        text = li.get_text(" ", strip=True)

        a = li.find("a", href=re.compile(rf"^/library/{re.escape(model_name)}:"))
        tag = ""
        if a and ":" in a["href"]:
            tag = a["href"].split(":", 1)[1]

        hash_match = re.search(r"\b([0-9a-f]{6,})\b", text)
        hash_ = hash_match.group(1) if hash_match else ""

        size_match = re.search(r"([\d\.]+\s*(?:GB|MB))", text, re.IGNORECASE)
        size = size_match.group(1) if size_match else ""

        updated_match = re.search(r"(\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago)$", text)
        updated = updated_match.group(1) if updated_match else ""

        tags.append({
            "tag":        tag,
            "hash":       hash_,
            "size":       size,
            "updated":    updated
        })

    if not tags:
        raise RequestError(500, message="Scraping found no model versions — page format likely changed.")

    return {
        "main_model": main_model,
        "tags":       tags
    }
