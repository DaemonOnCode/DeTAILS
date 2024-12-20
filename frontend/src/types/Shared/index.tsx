import { SERVER_ROUTES } from '../../constants/Shared';

export interface User {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}

export interface Token {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token: string;
    expiry_date: number;
}

// Define arguments for each route
export type RouteArgs = {
    [K in SERVER_ROUTES]: {
        server: Record<string, any>; // Default server args structure
        local: Record<string, any>; // Default local args structure
    };
};

// Define responses for each route
export type RouteResponse = {
    [K in SERVER_ROUTES]: {
        success: boolean; // Common success flag
        data?: any; // Generic data for responses
    };
};
