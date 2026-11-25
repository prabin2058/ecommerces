import { Outlet, ScrollRestoration } from "react-router-dom";
import Header from "../components/store/Header";
import Footer from "../components/store/Footer";
import MiniCart from "../components/store/MiniCart";

export default function StoreLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MiniCart />
      <ScrollRestoration />
    </div>
  );
}
