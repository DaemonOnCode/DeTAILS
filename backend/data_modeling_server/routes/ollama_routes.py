import time
import httpx
import requests
from fastapi import APIRouter, Depends, HTTPException, Body
from bs4 import BeautifulSoup
import re

from constants import OLLAMA_API_BASE
from errors.ollama_errors import DeleteModelError, InvalidModelError, PullModelError
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
        resp.raise_for_status()
        
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
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{OLLAMA_API_BASE}/api/pull", json=payload) as response:
                response.raise_for_status()
                last_sent = time.monotonic()
                interval = 1.0  
                async for line in response.aiter_lines():
                    if line:  
                        current_time = time.monotonic()
                        if current_time - last_sent >= interval:
                            await send_ipc_message(app_id, line)
                            last_sent = current_time
        return {"message": "Pull model streaming completed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error pulling model: {str(e)}")

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
    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail="Error fetching metadata from Ollama."
        )
    
    soup = BeautifulSoup(resp.text, "html.parser")
    
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
    
    tags = []
    tag_divs = soup.select("section div.flex.px-4.py-3")
    for tag_div in tag_divs:
        tag_info = {}
        a_elem = tag_div.find("a")
        if a_elem:
            tag_info["tag"] = a_elem.get_text(strip=True)
        else:
            tag_info["tag"] = ""
        
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