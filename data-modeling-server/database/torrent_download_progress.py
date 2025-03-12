from typing import List

from .base_class import BaseRepository
from models import TorrentDownloadProgress

class TorrentDownloadProgressRepository(BaseRepository[TorrentDownloadProgress]):
    model = TorrentDownloadProgress
    def __init__(self):
        super().__init__("torrent_download_progress", TorrentDownloadProgress)
    
    def get_progress(self, run_id: str) -> TorrentDownloadProgress:
        return self.find_one({"run_id": run_id})
    
    def update_progress(self,run_id: str, updates: dict):
        return self.update({"run_id": run_id}, updates)

    def delete_progress_for_run(self, run_id: str):
        return self.delete({"run_id": run_id})
    
    def get_current_status(self, workspace_id: str, dataset_id: str) -> str:
        query = """
        WITH overall AS (
  SELECT 
    run_id,
    workspace_id,
    dataset_id,
    status,
    progress,
    completed_files,
    total_files,
    subreddit,
    start_month,
    end_month,
    messages
  FROM torrent_download_progress
  WHERE workspace_id = ? AND dataset_id = ?
)
SELECT json_object(
  'overall', json_object(
       'runId', o.run_id,
       'status', o.status,
       'progress', o.progress,
       'completedFiles', o.completed_files,
       'totalFiles', o.total_files,
       'messages', o.messages,
       'subreddit', o.subreddit,
        'startMonth', o.start_month,
        'endMonth', o.end_month
  ),
  'steps', (
    SELECT json_group_array(
      json_object(
        'label', ps.step_label,
        'status', ps.status,
        'progress', ps.progress,
        'messages', ps.messages
      )
    )
    FROM pipeline_steps ps
    WHERE ps.run_id = o.run_id
      AND ps.workspace_id = o.workspace_id
      AND ps.dataset_id = o.dataset_id
    ORDER BY CASE ps.step_label
        WHEN 'Metadata' THEN 1
        WHEN 'Verification' THEN 2
        WHEN 'Downloading' THEN 3
        WHEN 'Symlinks' THEN 4
        WHEN 'Parsing' THEN 5
        ELSE 6
    END
  ),
  'files', (
    SELECT json_group_object(
      fs.file_name,
      json_object(
        'fileName', fs.file_name,
        'status', fs.status,
        'progress', fs.progress,
        'completedBytes', fs.completed_bytes,
        'totalBytes', fs.total_bytes,
        'messages', fs.messages
      )
    )
    FROM file_status fs
    WHERE fs.run_id = o.run_id
      AND fs.workspace_id = o.workspace_id
      AND fs.dataset_id = o.dataset_id
  )
) AS run_state
FROM overall o;
        """
        rows = self.execute_raw_query(query, (workspace_id, dataset_id), keys=True)
        print(rows)
        return rows
    

