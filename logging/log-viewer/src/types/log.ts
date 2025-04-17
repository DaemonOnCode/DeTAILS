export interface Log {
    id: number;
    email: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    timestamp: string;
    current_timestamp: string;
    sender: string;
}
