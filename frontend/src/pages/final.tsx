import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES } from "../constants/shared";

const FinalPage = () => {
  return (
    <div className="p-6 h-full flex justify-between flex-col">
        <div>
            <h2>Final Page</h2>
        </div>
        <NavigationBottomBar previousPage={ROUTES.CODING_VALIDATION}/>
    </div>
  );
}

export default FinalPage;