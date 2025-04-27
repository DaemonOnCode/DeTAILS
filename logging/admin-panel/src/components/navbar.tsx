import { Link } from "react-router-dom";

function NavBar() {
  return (
    <nav className="bg-gray-800 p-4 sticky top-0 z-50">
      <ul className="flex space-x-4">
        <li>
          <Link to="/select-db-file" className="text-white hover:text-gray-300">
            Select DB File
          </Link>
        </li>
        <li>
          <Link to="/timeline" className="text-white hover:text-gray-300">
            Timeline
          </Link>
        </li>
        <li>
          <Link to="/keyword-cloud" className="text-white hover:text-gray-300">
            Keyword Cloud
          </Link>
        </li>
        <li>
          <Link to="/keyword-table" className="text-white hover:text-gray-300">
            Keyword Table
          </Link>
        </li>
        <li>
          <Link to="/initial-coding" className="text-white hover:text-gray-300">
            Initial Coding
          </Link>
        </li>
        <li>
          <Link
            to="/initial-codebook"
            className="text-white hover:text-gray-300"
          >
            Initial Codebook
          </Link>
        </li>
        <li>
          <Link to="/final-coding" className="text-white hover:text-gray-300">
            Final Coding
          </Link>
        </li>
        <li>
          <Link
            to="/finalizing-codes"
            className="text-white hover:text-gray-300"
          >
            Finalizing Codes
          </Link>
        </li>
        <li>
          <Link to="/themes" className="text-white hover:text-gray-300">
            Themes
          </Link>
        </li>
        <li>
          <Link to="/error-rates" className="text-white hover:text-gray-300">
            Error Rates
          </Link>
        </li>
        <li>
          <Link to="/manual-coding" className="text-white hover:text-gray-300">
            Manual Coding
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default NavBar;
