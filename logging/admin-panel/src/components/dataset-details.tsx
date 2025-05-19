import React, { useState, useEffect } from "react";
import { useDatabase } from "./context";

interface GroupStat {
  groupName: string;
  postCount: number;
  commentCount: number;
  groupTotal: number;
}

interface Stats {
  totalPosts: number;
  totalComments: number;
  groupStats: GroupStat[];
  totalPostsInGroups: number;
  totalCommentsInGroups: number;
  totalFilteredPosts: number;
  totalFilteredComments: number;
  startDate: string;
  endDate: string;
}

const DatasetStats: React.FC = () => {
  const { executeQuery, selectedWorkspaceId } = useDatabase();
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    totalComments: 0,
    groupStats: [],
    totalPostsInGroups: 0,
    totalCommentsInGroups: 0,
    totalFilteredPosts: 0,
    totalFilteredComments: 0,
    startDate: "N/A",
    endDate: "N/A",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedWorkspaceId) {
        setError("No workspace selected");
        setLoading(false);
        return;
      }

      try {
        const totalPostsResult: { total: number }[] = await executeQuery(
          "SELECT COUNT(*) as total FROM posts WHERE workspace_id = ?",
          [selectedWorkspaceId]
        );
        const totalPosts = totalPostsResult[0]?.total || 0;

        const totalCommentsResult: { total: number }[] = await executeQuery(
          "SELECT COUNT(*) as total FROM comments WHERE workspace_id = ?",
          [selectedWorkspaceId]
        );
        const totalComments = totalCommentsResult[0]?.total || 0;

        const stateDumpResult: { state: string }[] = await executeQuery(
          `SELECT state FROM state_dumps
           WHERE json_extract(context, '$.function') = 'sample_posts'
           AND json_extract(context, '$.workspace_id') = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [selectedWorkspaceId]
        );

        let groupStats: GroupStat[] = [];
        let totalPostsInGroups = 0;
        let totalCommentsInGroups = 0;

        if (stateDumpResult.length > 0) {
          const state: { groups: { [key: string]: string[] } } = JSON.parse(
            stateDumpResult[0].state
          );
          const groups = state.groups || {};

          const allPostIds = Array.from(new Set(Object.values(groups).flat()));

          if (allPostIds.length > 0) {
            const commentCountsResult: {
              post_id: string;
              comment_count: number;
            }[] = await executeQuery(
              `SELECT post_id, COUNT(*) as comment_count
               FROM comments
               WHERE post_id IN (${allPostIds.map(() => "?").join(",")})
               AND workspace_id = ?
               GROUP BY post_id`,
              [...allPostIds, selectedWorkspaceId]
            );

            const commentCounts = new Map<string, number>(
              commentCountsResult.map((row) => [row.post_id, row.comment_count])
            );

            groupStats = Object.entries(groups).map(
              ([groupName, postIds]: [string, string[]]) => {
                const mappedName =
                  groupName === "sampled"
                    ? "Initial"
                    : groupName === "unseen"
                    ? "Final"
                    : groupName;
                const postCount = postIds.length;
                const commentCount = postIds.reduce(
                  (sum, id) => sum + (commentCounts.get(id) || 0),
                  0
                );
                return {
                  groupName: mappedName,
                  postCount,
                  commentCount,
                  groupTotal: postCount + commentCount,
                };
              }
            );

            totalPostsInGroups = groupStats.reduce(
              (sum, stat) => sum + stat.postCount,
              0
            );
            totalCommentsInGroups = groupStats.reduce(
              (sum, stat) => sum + stat.commentCount,
              0
            );
          }
        }

        const filterStateResult: { state: string }[] = await executeQuery(
          `SELECT state FROM state_dumps
           WHERE json_extract(context, '$.function') = 'setDataFilters'
           AND json_extract(context, '$.workspace_id') = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [selectedWorkspaceId]
        );

        let filters = {
          start_time: null as number | null,
          end_time: null as number | null,
          hide_removed: false,
        };

        if (filterStateResult.length > 0) {
          const filterState: {
            current_state: {
              reddit: {
                start_time: string;
                end_time: string;
                hide_removed: boolean;
              };
            };
          } = JSON.parse(filterStateResult[0].state);
          const redditFilters = filterState.current_state.reddit;
          filters = {
            start_time: redditFilters.start_time
              ? new Date(redditFilters.start_time).getTime() / 1000
              : null,
            end_time: redditFilters.end_time
              ? new Date(redditFilters.end_time).getTime() / 1000
              : null,
            hide_removed: redditFilters.hide_removed,
          };
        }

        let baseQuery = `
          FROM posts p
          WHERE p.workspace_id = ?
        `;

        if (filters.hide_removed) {
          baseQuery += `
            AND (
              (p.title NOT IN ('[removed]', '[deleted]')
              AND p.selftext NOT IN ('[removed]', '[deleted]'))
              OR EXISTS (
                SELECT 1
                FROM comments c
                WHERE c.workspace_id = p.workspace_id
                  AND c.post_id = p.id
              )
            )
          `;
        }

        if (filters.start_time) {
          baseQuery += ` AND p.created_utc >= ?`;
        }
        if (filters.end_time) {
          baseQuery += ` AND p.created_utc <= ?`;
        }

        const params = [selectedWorkspaceId];
        if (filters.start_time) params.push(filters.start_time.toString());
        if (filters.end_time) params.push(filters.end_time.toString());

        const filteredPostsQuery = `
          SELECT p.id, MIN(p.created_utc) as start_ts, MAX(p.created_utc) as end_ts
          ${baseQuery}
          GROUP BY p.id
        `;

        const filteredPostsResult: {
          id: string;
          start_ts: number;
          end_ts: number;
        }[] = await executeQuery(filteredPostsQuery, params);

        const filteredPostIds = filteredPostsResult.map((row) => row.id);
        const totalFilteredPosts = filteredPostIds.length;

        const startDate =
          filteredPostsResult.length > 0
            ? new Date(
                Math.min(...filteredPostsResult.map((row) => row.start_ts)) *
                  1000
              ).toLocaleDateString()
            : "N/A";
        const endDate =
          filteredPostsResult.length > 0
            ? new Date(
                Math.max(...filteredPostsResult.map((row) => row.end_ts)) * 1000
              ).toLocaleDateString()
            : "N/A";

        const commentCountsResult: { comment_count: number }[] =
          await executeQuery(
            `SELECT COUNT(*) as comment_count
           FROM comments
           WHERE post_id IN (${filteredPostIds.map(() => "?").join(",")})
           AND workspace_id = ?`,
            [...filteredPostIds, selectedWorkspaceId]
          );
        const totalFilteredComments =
          commentCountsResult[0]?.comment_count || 0;

        setStats({
          totalPosts,
          totalComments,
          groupStats,
          totalPostsInGroups,
          totalCommentsInGroups,
          totalFilteredPosts,
          totalFilteredComments,
          startDate,
          endDate,
        });
        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    fetchData();
  }, [executeQuery, selectedWorkspaceId]);

  if (loading) {
    return <div className="p-4 text-gray-600">Loading statistics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Dataset Statistics
      </h1>

      <div className="mb-4">
        <p className="text-gray-600">
          <strong>Total Posts:</strong> {stats.totalPosts}
        </p>
        <p className="text-gray-600">
          <strong>Total Comments:</strong> {stats.totalComments}
        </p>
      </div>

      <h2 className="text-xl font-semibold mb-2 text-gray-700">
        Filtered Statistics
      </h2>
      <div className="mb-4">
        <p className="text-gray-600">
          <strong>Filtered Posts:</strong> {stats.totalFilteredPosts}
        </p>
        <p className="text-gray-600">
          <strong>Filtered Comments:</strong> {stats.totalFilteredComments}
        </p>
        <p className="text-gray-600">
          <strong>Start Date:</strong> {stats.startDate}
        </p>
        <p className="text-gray-600">
          <strong>End Date:</strong> {stats.endDate}
        </p>
      </div>

      <h2 className=" BITStext-xl font-semibold mb-2 text-gray-700">
        Group Statistics
      </h2>
      {stats.groupStats.length > 0 ? (
        <table className="w-full border-collapse border border-gray-300 mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Group</th>
              <th className="p-2 border">Posts</th>
              <th className="p-2 border">Comments</th>
              <th className="p-2 border">Total (Posts + Comments)</th>
            </tr>
          </thead>
          <tbody>
            {stats.groupStats.map((stat) => (
              <tr key={stat.groupName} className="hover:bg-gray-50">
                <td className="p-2 border">{stat.groupName}</td>
                <td className="p-2 border">{stat.postCount}</td>
                <td className="p-2 border">{stat.commentCount}</td>
                <td className="p-2 border">{stat.groupTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mb-4 text-gray-600">No group statistics available.</p>
      )}
      <h2 className="text-xl font-semibold mb-2 text-gray-700">Summary</h2>
      <div>
        <p className="text-gray-600">
          <strong>Total Posts in Groups:</strong> {stats.totalPostsInGroups}
        </p>
        <p className="text-gray-600">
          <strong>Total Comments in Groups:</strong>{" "}
          {stats.totalCommentsInGroups}
        </p>
      </div>
    </div>
  );
};

export default DatasetStats;
