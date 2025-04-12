from fastapi import Header, HTTPException, Depends

async def get_workspace_id(x_workspace_id: str = Header(...)):
    """
    Dependency to extract the 'x-workspace-id' header.
    Raises an HTTP 400 error if the header is missing.
    """
    if not x_workspace_id:
        raise HTTPException(status_code=400, detail="X-App-Id header is required")
    return x_workspace_id
