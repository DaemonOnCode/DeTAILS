import { FC } from "react";

type NavigationBottomBarProps = {
    isReady?: boolean;
    previousPage?: string;
    nextPage?: string;
}

const NavigationBottomBar: FC<
    NavigationBottomBarProps
> = ({isReady, previousPage, nextPage}) => {
  return (
    <div className="flex justify-between mt-6">
      <a
        href={previousPage}
        className={`${!previousPage && "invisible"} px-4 py-2 rounded transition duration-200 bg-blue-500 text-white hover:bg-blue-600`}
      >
        &lt;- Go back
      </a>
    {nextPage &&
      <a
        href={nextPage}
        className={`px-4 py-2 rounded transition duration-200 ${
          isReady
            ? "bg-green-500 text-white hover:bg-green-600"
            : "bg-gray-400 text-gray-200 cursor-not-allowed"
        }`}
        onClick={(e) => !isReady && e.preventDefault()} // Prevent navigation if disabled
      >
        Proceed -&gt;
      </a>
    }
    </div>
  );
};

export default NavigationBottomBar;
