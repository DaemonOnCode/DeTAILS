import { FC } from "react";
import { ROUTES } from "../../constants/shared";

export const Sidebar: FC = () => {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white fixed">
      <nav className="">
        <ul>
          <a href={ROUTES.HOME}>
            <li className="p-4 hover:bg-gray-700">Home</li>
          </a>

          <a href={ROUTES.FINAL}>
            <li className="p-4 hover:bg-gray-700">Random</li>
          </a>
        </ul>
      </nav>
    </div>
  );
};
