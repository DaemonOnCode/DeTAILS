import { FC } from "react";
import { Layout } from "../components/Layout";

export const NotFound: FC = () => {
    console.log("404 Not Found");   
    return (
        <div className="p-4">404 Not Found</div>
    );
};