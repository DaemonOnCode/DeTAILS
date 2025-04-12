from fastapi import Header, HTTPException, Depends

async def get_app_id(x_app_id: str = Header(...)):
    """
    Dependency to extract the 'x-app-id' header.
    Raises an HTTP 400 error if the header is missing.
    """
    if not x_app_id:
        raise HTTPException(status_code=400, detail="X-App-Id header is required")
    return x_app_id
