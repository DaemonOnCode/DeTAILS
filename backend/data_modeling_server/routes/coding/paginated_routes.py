
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Header

from controllers.coding_controller import _apply_type_filters
from database.db_helpers import execute_query
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import PaginatedPostRequest, PaginatedRequest


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])

@router.post("/paginated-posts")
async def paginated_posts(
    req: PaginatedRequest,
    workspace_id: str = Header(..., alias="x-workspace-id"),
):
    filters = ["p.workspace_id = ?", "r.workspace_id = ?"]
    params  = [workspace_id, workspace_id]

    _apply_type_filters(req.responseTypes, filters, params)

    if req.filterCode:
        filters.append("r.code = ?");     params.append(req.filterCode)
    if req.searchTerm:
        filters.append("(r.quote LIKE ? OR r.explanation LIKE ?)")
        like = f"%{req.searchTerm}%"
        params += [like, like]

    where = " AND ".join(filters)

    total_sql = f"""
    SELECT COUNT(DISTINCT p.post_id)
      FROM selected_post_ids p
      JOIN qect r
        ON r.post_id = p.post_id
       AND r.workspace_id = p.workspace_id
     WHERE {where}
    """
    total = execute_query(total_sql, params)[0][0]

    offset = (req.page - 1) * req.pageSize
    slice_sql = f"""
    SELECT DISTINCT p.post_id
      FROM selected_post_ids p
      JOIN qect r
        ON r.post_id = p.post_id
       AND r.workspace_id = p.workspace_id
     WHERE {where}
  ORDER BY p.post_id DESC
     LIMIT ? OFFSET ?
    """
    slice_params = params + [req.pageSize, offset]
    rows = execute_query(slice_sql, slice_params, keys=True)
    post_ids = [r["post_id"] for r in rows]

    titles: Dict[str,str] = {}
    if post_ids:
        ph = ",".join("?" for _ in post_ids)
        title_sql = f"SELECT id, title FROM posts WHERE id IN ({ph})"
        trows = execute_query(title_sql, post_ids, keys=True)
        titles = {r["id"]: r["title"] for r in trows}

    hasNext     = (offset + len(post_ids)) < total
    hasPrevious = req.page > 1

    return {
        "postIds": post_ids,
        "titles": titles,
        "total": total,
        "hasNext": hasNext,
        "hasPrevious": hasPrevious,
    }


@router.post("/paginated-responses")
async def paginated_responses(
    req: PaginatedRequest,
    workspace_id: str = Header(..., alias="x-workspace-id"),
):
    filters = ["p.workspace_id = ?", "r.workspace_id = ?"]
    params: List[Any] = [workspace_id, workspace_id]

    if (
        req.selectedTypeFilter in ["New Data", "Initial Data"]
        and not (len(req.responseTypes or []) == 1 and req.responseTypes[0] == "sampled")
    ):
        if req.selectedTypeFilter == "New Data":
            filters.append("p.type = ?")
            params.append("unseen")
        else:
            filters.append("p.type = ?")
            params.append("sampled")
    elif req.responseTypes:
        temp_filters = set()
        temp_params = set()
        if "sampled" in req.responseTypes:
            temp_filters.add("p.type = ?")
            temp_params.add("sampled")
        if "unseen" in req.responseTypes:
            temp_filters.add("p.type = ?")
            temp_params.add("unseen")
        if "manual" in req.responseTypes:
            temp_filters.add("p.type = ?")
            temp_params.add("manual")
        if "sampled_copy" in req.responseTypes:
            temp_filters.add("p.type = ?")
            temp_params.add("sampled")
        ph = ",".join("?" for _ in temp_params)
        filters.append(f"p.type IN ({ph})")
        params.extend(list(temp_params))

    _apply_type_filters(req.responseTypes, filters, params)


    if req.selectedTypeFilter == "Human":
        filters.append("r.response_type = ?"); params.append("Human")
    elif req.selectedTypeFilter == "LLM":
        filters.append("r.response_type = ?"); params.append("LLM")

    stripped_post_id = req.postId.replace("|coded-data", "") if req.postId else None
    print("stripped_post_id", stripped_post_id, req.postId)
    if stripped_post_id and req.postId != "coded-data":
        filters.append("r.post_id = ?")
        params.append(stripped_post_id)

    print(f"[paginated_responses] filterCode: {req.filterCode}, searchTerm: {req.searchTerm}")
    if req.filterCode:
        filters.append("r.code = ?")
        params.append(req.filterCode)
        
    print(f"markedTrue: {req.markedTrue}")
    if req.markedTrue:
        filters.append("r.is_marked = ?")
        params.append(1)


    where_clause = " AND ".join(filters)

    total_rows_sql = f"""
    SELECT COUNT(*)
      FROM qect r
      JOIN selected_post_ids p
        ON r.post_id = p.post_id
       AND r.workspace_id = p.workspace_id
     WHERE {where_clause}
    """
    total_rows = execute_query(total_rows_sql, params)[0][0]

    offset = (req.page - 1) * req.pageSize
    slice_sql = f"""
    SELECT r.id
      FROM qect r
      JOIN selected_post_ids p
        ON r.post_id = p.post_id
       AND r.workspace_id = p.workspace_id
     WHERE {where_clause}
  ORDER BY r.post_id ASC
     LIMIT ? OFFSET ?
    """
    print(f"[paginated_responses] slice_sql: {slice_sql}", params)
    slice_ids = execute_query(slice_sql, params + [req.pageSize, offset])
    page_ids = [r[0] for r in slice_ids]

    resp_rows = []
    if page_ids:
        ph2 = ",".join("?" for _ in page_ids)
        resp_sql = f"""
        SELECT r.*
          FROM qect r
          JOIN selected_post_ids p
            ON r.post_id = p.post_id
           AND r.workspace_id = p.workspace_id
         WHERE {where_clause}
           AND r.id IN ({ph2})
      ORDER BY r.post_id ASC
        """
        resp_rows = execute_query(resp_sql, params + page_ids, keys=True)

    responses: Dict[str, List[Dict[str, Any]]] = {}
    for row in resp_rows:
        transformed_row = {
            "id": row["id"],
            "postId": row["post_id"],
            "quote": row["quote"],
            "explanation": row["explanation"],
            "code": row["code"],
            "type": row["response_type"],
            "codebookType": row["codebook_type"],
            "chatHistory": row["chat_history"],
            "rangeMarker": row["range_marker"],
            "isMarked": bool(row["is_marked"]) if row["is_marked"] is not None else None,
        }
        post_id = row["post_id"] 
        responses.setdefault(post_id, []).append(transformed_row)

    return {
        "postIds": list(responses.keys()),
        "responses": responses,
        "totalPostIds": total_rows,
        "hasNext": offset + len(page_ids) < total_rows,
        "hasPrevious": req.page > 1,
    }

@router.post("/paginated-posts-metadata")
async def paginated_posts_metadata(
    req: PaginatedPostRequest,
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    print(f"[paginated_posts_metadata] responseTypes: {req.responseTypes}, selectedTypeFilter: {req.selectedTypeFilter}")
    if req.selectedTypeFilter in ['New Data', 'Initial Data'] and not (len(req.responseTypes) == 1 and req.responseTypes[0] == 'sampled'):
        type_filter = "p.type = ?"
        type_params = []
        if req.selectedTypeFilter == 'New Data':
            type_params.append('unseen')
        elif req.selectedTypeFilter == 'Initial Data':
            type_params.append('sampled')
    else:
        if req.responseTypes:
            type_placeholders = ", ".join(["?" for _ in req.responseTypes])
            type_filter = f"p.type IN ({type_placeholders})"
            type_params = []
            if "sampled" in req.responseTypes:
                type_params.append("sampled")
            if "unseen" in req.responseTypes:
                type_params.append("unseen")
            if "manual" in req.responseTypes:
                type_params.append("manual")
            if "sampled_copy" in req.responseTypes:
                type_params.append("sampled")
        else:
            type_filter = "1=1" 
            type_params = []

    print(f"[paginated_posts_metadata] type_filter: {type_filter}, type_params: {type_params}")

    base_params = [workspace_id] + type_params

    if req.searchTerm:
        search_filter = "LOWER(p2.title) LIKE ?"
        search_param = f"%{req.searchTerm.lower()}%"  
    else:
        search_filter = ""
        search_param = None

    filters = ["p.workspace_id = ?", type_filter]
    params = base_params
    if search_filter:
        filters.append(search_filter)
        params = base_params + [search_param]

    if req.onlyCoded:
        subquery = """
        EXISTS (
            SELECT 1 FROM qect r
            WHERE r.post_id = p.post_id AND r.workspace_id = p.workspace_id
        )
        """
        filters.append(subquery)

    where_clause = " AND ".join(filters)

    total_sql = f"""
    SELECT COUNT(DISTINCT p.post_id)
    FROM selected_post_ids p
    JOIN posts p2 ON p.post_id = p2.id
    WHERE {where_clause}
    """
    total = execute_query(total_sql, params)[0][0]

    total_posts_sql = f"""
    SELECT COUNT(DISTINCT p.post_id)
    FROM selected_post_ids p
    WHERE p.workspace_id = ? AND ({type_filter})
    """
    total_posts = execute_query(total_posts_sql, [workspace_id] + type_params)[0][0]

    total_coded_sql = f"""
    SELECT COUNT(DISTINCT p.post_id)
    FROM selected_post_ids p
    WHERE p.workspace_id = ? AND ({type_filter}) AND EXISTS (
        SELECT 1 FROM qect r
        WHERE r.post_id = p.post_id AND r.workspace_id = p.workspace_id
    )
    """
    total_coded_posts = execute_query(total_coded_sql, [workspace_id] + type_params)[0][0]

    offset = (req.page - 1) * req.pageSize
    slice_sql = f"""
    SELECT DISTINCT p.post_id, p2.title
    FROM selected_post_ids p
    JOIN posts p2 ON p.post_id = p2.id
    WHERE {where_clause}
    ORDER BY p.post_id ASC
    LIMIT ? OFFSET ?
    """
    slice_params = params + [req.pageSize, offset]
    rows = execute_query(slice_sql, slice_params)

    post_ids = [str(row[0]) for row in rows]
    titles = {str(row[0]): row[1] for row in rows}

    return {
        "postIds": post_ids,
        "titles": titles,
        "total": total,
        "totalPosts": total_posts,
        "totalCodedPosts": total_coded_posts,
        "hasNext": offset + len(post_ids) < total,
        "hasPrevious": req.page > 1
    }
        
@router.post("/paginated-codes")
async def paginated_codes(
    req: PaginatedPostRequest,
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    filters = ["p.workspace_id = ?", "r.workspace_id = ?"]
    params = [workspace_id, workspace_id]

    response_filters = []
    if "sampled" in req.responseTypes:
        response_filters.append("r.codebook_type = 'initial'")
    if "unseen" in req.responseTypes:
        response_filters.append("r.codebook_type = 'final'")
    if "manual" in req.responseTypes:
        response_filters.append("r.codebook_type = 'manual'")
    if "sampled_copy" in req.responseTypes:
        response_filters.append("r.codebook_type = 'initial_copy'")
    
    if response_filters:
        filters.append("(" + " OR ".join(response_filters) + ")")

    if req.selectedTypeFilter == 'Human':
        filters.append("r.response_type = ?")
        params.append('Human')
    elif req.selectedTypeFilter == 'LLM':
        filters.append("r.response_type = ?")
        params.append('LLM')

    if req.searchTerm:
        filters.append("LOWER(r.code) LIKE ?")
        params.append(f"%{req.searchTerm.lower()}%")

    where_clause = " AND ".join(filters)

    total_sql = f"""
        SELECT COUNT(DISTINCT r.code)
        FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id AND r.workspace_id = p.workspace_id
        WHERE {where_clause}
    """
    totalCodes = execute_query(total_sql, params)[0][0]

    offset = (req.page - 1) * req.pageSize
    slice_sql = f"""
        SELECT DISTINCT r.code
        FROM qect r
        JOIN selected_post_ids p ON r.post_id = p.post_id AND r.workspace_id = p.workspace_id
        WHERE {where_clause}
        ORDER BY r.code
        LIMIT ? OFFSET ?
    """
    rows = execute_query(slice_sql, params + [req.pageSize, offset], keys=True)
    codes = [r["code"] for r in rows if r["code"]]

    hasNext = offset + len(codes) < totalCodes
    hasPrevious = req.page > 1

    return {
        "codes": codes,
        "totalCodes": totalCodes,
        "hasNext": hasNext,
        "hasPrevious": hasPrevious,
    }
