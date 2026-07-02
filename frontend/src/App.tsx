import { Route, Routes } from "react-router-dom";
import Nav from "./components/Nav";
import CatalogPage from "./pages/CatalogPage";
import DishDetailPage from "./pages/DishDetailPage";
import MenuPage from "./pages/MenuPage";
import PhotoPage from "./pages/PhotoPage";
import SavedPage from "./pages/SavedPage";
import ShoppingPage from "./pages/ShoppingPage";
import { MenuPlanProvider } from "./state/menuPlanContext";
import { ShoppingContributionsProvider } from "./state/shoppingContributionsContext";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main>
        <MenuPlanProvider>
          <ShoppingContributionsProvider>
            <Routes>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/dishes" element={<CatalogPage />} />
              <Route path="/dishes/:id" element={<DishDetailPage />} />
              <Route path="/photo" element={<PhotoPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
            </Routes>
          </ShoppingContributionsProvider>
        </MenuPlanProvider>
      </main>
    </div>
  );
}
