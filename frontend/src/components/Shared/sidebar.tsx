import { FC } from "react";

export const Sidebar: FC = () => {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white fixed">
      <nav className="">
        <ul>
          <a href="#/">
            <li className="p-4 hover:bg-gray-700">Home</li>
          </a>

          <a href="#/lol">
            <li className="p-4 hover:bg-gray-700">Homel</li>
          </a>
        </ul>
      </nav>
    </div>
  );
};
