import { useState, useEffect } from 'react';
import { Log } from '../types/log';

function LogViewer() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [filters, setFilters] = useState({
        email: '',
        level: '',
        start_time: '',
        end_time: ''
    });

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`http://localhost:9000/api/logs?${params}`);
            const data = await response.json();
            setLogs(data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const handleFilterChange = (e: any) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleSearch = () => fetchLogs();

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6">Log Viewer</h1>

            {/* Filter Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <input
                    type="text"
                    name="email"
                    placeholder="Email"
                    value={filters.email}
                    onChange={handleFilterChange}
                    className="input input-bordered w-full"
                />
                <select
                    name="level"
                    value={filters.level}
                    onChange={handleFilterChange}
                    className="input input-bordered w-full">
                    <option value="">Select Level</option>
                    <option value="INFO">INFO</option>
                    <option value="ERROR">ERROR</option>
                    <option value="DEBUG">DEBUG</option>
                    <option value="TIME">TIME</option>
                    <option value="HEALTH">HEALTH</option>
                    <option value="INFO">INFO</option>
                </select>
                <input
                    type="datetime-local"
                    name="start_time"
                    value={filters.start_time}
                    onChange={handleFilterChange}
                    className="input input-bordered w-full"
                />
                <input
                    type="datetime-local"
                    name="end_time"
                    value={filters.end_time}
                    onChange={handleFilterChange}
                    className="input input-bordered w-full"
                />
            </div>

            <button
                onClick={handleSearch}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500">
                Search Logs
            </button>

            {/* Logs Table */}
            <div className="overflow-x-auto mt-6">
                <table className="table-auto w-full border-collapse border">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border px-4 py-2">ID</th>
                            <th className="border px-4 py-2">Email</th>
                            <th className="border px-4 py-2">Level</th>
                            <th className="border px-4 py-2">Message</th>
                            <th className="border px-4 py-2">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-100">
                                <td className="border px-4 py-2">{log.id}</td>
                                <td className="border px-4 py-2">{log.email}</td>
                                <td className="border px-4 py-2">{log.level}</td>
                                <td className="border px-4 py-2">{log.message}</td>
                                <td className="border px-4 py-2">
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default LogViewer;
