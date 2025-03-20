import time
import httpx
import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse
from bs4 import BeautifulSoup
import re

from errors.ollama_errors import DeleteModelError, InvalidModelError, PullModelError
from headers.app_id import get_app_id
from routes.websocket_routes import manager

router = APIRouter(dependencies=[Depends(get_app_id)])

# Base URL for the Ollama API server.
OLLAMA_API_BASE = "http://localhost:11434"

@router.get("/list-models")
def list_local_models():
    """
    Proxy to GET /api/tags on the Ollama API, which returns the list of local models.
    """
    # try:
    resp = requests.get(f"{OLLAMA_API_BASE}/api/tags")
    resp.raise_for_status()
    return resp.json()
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Error listing local models: {str(e)}")

@router.delete("/delete-model")
def delete_model(payload: dict = Body(...)):
    """
    Proxy to DELETE /api/delete on the Ollama API.
    Request body must include {"model": "<model_name>"}.
    """
    try:
        resp = requests.delete(f"{OLLAMA_API_BASE}/api/delete", json=payload)
        resp.raise_for_status()
        # If the response body is empty, return a default message.
        if not resp.text.strip():
            return {"message": "Model deleted successfully."}
        return resp.json()
    except Exception as e:
        raise DeleteModelError(f"Error deleting model: {str(e)}")

@router.post("/pull-model")
async def pull_model(
    payload: dict = Body(...),
    app_id: str = Depends(get_app_id)
):
    """
    Proxy to POST /api/pull on the Ollama API with streaming enabled.
    Only sends a streamed line via websockets if a specified time interval has passed.
    """
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{OLLAMA_API_BASE}/api/pull", json=payload) as response:
                response.raise_for_status()
                last_sent = time.monotonic()
                interval = 1.0  # seconds; adjust as needed
                async for line in response.aiter_lines():
                    if line:  # Process only non-empty lines
                        current_time = time.monotonic()
                        if current_time - last_sent >= interval:
                            await manager.send_message(app_id, line)
                            last_sent = current_time
        return {"message": "Pull model streaming completed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error pulling model: {str(e)}")

def parse_size(size_str: str) -> float:
    """
    Convert a file size string (e.g., '2.2GB', '750MB') to a float in gigabytes.
    (This helper is kept here if you want to do any size calculations.)
    """
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
    """
    Fetch and parse metadata for a model from the public Ollama library page:
      https://ollama.com/library/<model_name>/tags

    Returns a JSON object with two parts:
      - "main_model": an object with the main model's name and description.
      - "tags": an array of available model tag entries where each tag includes:
          - "tag": the model tag (e.g. "latest", "3.8b", etc.)
          - "hash": the file hash shown on the tag block.
          - "size": the file size string (e.g. "2.2GB").
          - "updated": the updated time text.
    Only tags with a non-empty tag name are returned.
    """
    url = f"https://ollama.com/library/{model_name}/tags"
    # try:
    resp = requests.get(url)
    if resp.status_code == 404:
        raise InvalidModelError(f"Model '{model_name}' not found.")
    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail="Error fetching metadata from Ollama."
        )
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Error fetching metadata: {str(e)}")
    
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Extract main model details
    main_model = {}
    name_elem = soup.find("a", attrs={"x-test-model-name": True})
    if name_elem:
        main_model["name"] = name_elem.get_text(strip=True)
    else:
        main_model["name"] = ""
    
    desc_elem = soup.find("span", id="summary-content")
    if desc_elem:
        main_model["description"] = desc_elem.get_text(strip=True)
    else:
        main_model["description"] = ""
    
    # Extract available tag entries and filter out those with empty tag names.
    tags = []
    tag_divs = soup.select("section div.flex.px-4.py-3")
    for tag_div in tag_divs:
        tag_info = {}
        a_elem = tag_div.find("a")
        if a_elem:
            tag_info["tag"] = a_elem.get_text(strip=True)
        else:
            tag_info["tag"] = ""
        
        # Only process this tag if tag_info["tag"] is not empty.
        if not tag_info["tag"]:
            continue
        
        detail_div = tag_div.find("div", class_=lambda x: x and "items-baseline" in x)
        if detail_div:
            detail_text = detail_div.get_text(separator=" ", strip=True)
            parts = [part.strip() for part in detail_text.split("•")]
            if len(parts) >= 3:
                tag_info["hash"] = parts[0]
                tag_info["size"] = parts[1]
                tag_info["updated"] = parts[2]
            else:
                tag_info["hash"] = ""
                tag_info["size"] = ""
                tag_info["updated"] = ""
        else:
            tag_info["hash"] = ""
            tag_info["size"] = ""
            tag_info["updated"] = ""
        
        tags.append(tag_info)
    
    return {
        "main_model": main_model,
        "tags": tags
    }