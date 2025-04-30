import csv
import os
import tempfile
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Header
from fastapi.responses import FileResponse

from database.db_helpers import execute_query, tuned_connection
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import AnalysisRequest


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])

BASE_JOIN = """
  FROM qect r
  LEFT JOIN grouped_code_entries g
    ON r.code = g.code
   AND g.coding_context_id = :workspace_id
  LEFT JOIN theme_entries t
    ON g.higher_level_code = t.higher_level_code
   AND t.coding_context_id = :workspace_id
  WHERE r.workspace_id = :workspace_id
    AND r.codebook_type IN ('initial', 'final')
    AND r.is_marked = 1
"""

@router.post("/analysis-report")
async def analysis_report(
    req: AnalysisRequest = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    if req.page < 1 or req.pageSize < 1:
        raise HTTPException(400, "Invalid pagination parameters")

    offset = (req.page - 1) * req.pageSize
    params = {"workspace_id": workspace_id, "limit": req.pageSize, "offset": offset}

    if req.viewType == "post":
        stats_sql = f"""
        SELECT
          COUNT(DISTINCT r.post_id)    AS totalUniquePosts,
          COUNT(DISTINCT g.higher_level_code) AS totalUniqueCodes,
          COUNT(*)                     AS totalQuoteCount
        {BASE_JOIN}
        """
    else:  
        stats_sql = f"""
        SELECT
          COUNT(DISTINCT g.higher_level_code) AS totalUniqueCodes,
          COUNT(DISTINCT r.post_id)    AS totalUniquePosts,
          COUNT(*)                     AS totalQuoteCount
        {BASE_JOIN}
        """
    stat_row = execute_query(stats_sql, params, keys=True)[0]
    print(f"stat_row: {stat_row}")
    overall_stats = dict(zip(stat_row.keys(), stat_row.values()))

    if req.viewType == "post" and not req.summary:
        data_sql = f"""
        SELECT
          r.id,
          r.post_id    AS postId,
          g.higher_level_code AS code,
          t.theme               AS theme,
          r.quote,
          r.explanation
        {BASE_JOIN}
        ORDER BY r.id DESC
        LIMIT :limit OFFSET :offset
        """
        rows = execute_query(data_sql, params, keys=True)
        total = overall_stats["totalQuoteCount"]

    elif req.viewType == "post" and req.summary:
        data_sql = f"""
        SELECT
          r.post_id             AS postId,
          COUNT(DISTINCT g.higher_level_code) AS uniqueCodeCount,
          COUNT(*)              AS totalQuoteCount
        {BASE_JOIN}
        GROUP BY r.post_id
        ORDER BY r.post_id DESC
        LIMIT :limit OFFSET :offset
        """
        rows = execute_query(data_sql, params, keys=True)
        total = overall_stats["totalUniquePosts"]

    elif req.viewType == "code" and not req.summary:
        data_sql = f"""
        SELECT
          r.id,
          r.post_id            AS postId,
          g.higher_level_code AS code,
          t.theme              AS theme,
          r.quote,
          r.explanation
        {BASE_JOIN}
        ORDER BY r.id DESC
        LIMIT :limit OFFSET :offset
        """
        rows = execute_query(data_sql, params, keys=True)
        total = overall_stats["totalQuoteCount"]

    else:
        data_sql = f"""
        SELECT
          t.theme               AS theme,
          COUNT(DISTINCT r.post_id) AS uniquePosts,
          COUNT(DISTINCT g.higher_level_code) AS uniqueCodes,
          COUNT(*)                  AS totalQuoteCount
        {BASE_JOIN}
        GROUP BY t.theme
        ORDER BY t.theme
        LIMIT :limit OFFSET :offset
        """
        rows = execute_query(data_sql, params, keys=True)
        total = overall_stats["totalUniqueCodes"]  

    return {
        "overallStats": overall_stats,
        "rows": rows,
        "meta": {
            "totalItems": total,
            "hasNext": offset + len(rows) < total,
            "hasPrevious": req.page > 1
        }
    }

@router.post("/analysis-download")
async def download_report(
    request_body: AnalysisRequest,
    background_tasks: BackgroundTasks,
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    viewType = request_body.viewType
    summary = request_body.summary
    
    if viewType == "post" and not summary:
        sql = f"""
        SELECT
          r.id,
          r.post_id            AS postId,
          g.higher_level_code  AS code,
          t.theme              AS theme,
          r.quote,
          r.explanation
        {BASE_JOIN}
        ORDER BY r.id
        """
    elif viewType == "post" and summary:
        sql = f"""
        SELECT
          r.post_id             AS postId,
          COUNT(DISTINCT g.higher_level_code) AS uniqueCodeCount,
          COUNT(*)              AS totalQuoteCount
        {BASE_JOIN}
        GROUP BY r.post_id
        ORDER BY r.post_id
        """
    elif viewType == "code" and not summary:
        sql = f"""
        SELECT
          r.id,
          r.post_id            AS postId,
          g.higher_level_code  AS code,
          t.theme              AS theme,
          r.quote,
          r.explanation
        {BASE_JOIN}
        ORDER BY r.id
        """
    else:
        sql = f"""
        SELECT
          t.theme               AS theme,
          COUNT(DISTINCT r.post_id) AS uniquePosts,
          COUNT(DISTINCT g.higher_level_code) AS uniqueCodes,
          COUNT(*)                  AS totalQuoteCount
        {BASE_JOIN}
        GROUP BY t.theme
        ORDER BY t.theme
        """

    conn = tuned_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql, {"workspace_id": workspace_id})
        columns = [col[0] for col in cursor.description]


        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w", newline="", encoding="utf-8")
        writer = csv.writer(tmp)
        writer.writerow(columns)

        while True:
            batch = cursor.fetchmany(500)
            if not batch:
                break
            for row in batch:
                if not summary:
                    row = list(map(lambda x: {
                        "postId": x[1],
                        "theme": x[4],
                        "higherLevelCode": x[3],
                        "code": x[2],
                        "quote": x[5],
                        "explanation": x[6],
                    }, row))
                clean = [("" if cell is None else cell) for cell in row]
                writer.writerow(clean)

        tmp.flush()
        tmp.close()

    finally:
        cursor.close()
        conn.close()

    background_tasks.add_task(os.remove, tmp.name)
    filename = f"{viewType}_{'summary' if summary else 'detailed'}_analysis.csv"
    return FileResponse(
        tmp.name,
        media_type="text/csv",
        filename=filename,
        background=background_tasks
    )
