import { useEffect } from "react";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import StoreLayout from "./layouts/StoreLayout";
import { RequireAuth, GuestOnly } from "./layouts/Guards";
import Home from "./pages/store/Home";
import Shop from "./pages/store/Shop";
import ProductDetail from "./pages/store/ProductDetail";
import Cart from "./pages/store/Cart";
import Checkout from "./pages/store/Checkout";
import CheckoutReturn from "./pages/store/CheckoutReturn";
import OrderDetail from "./pages/store/OrderDetail";
import NotFound from "./pages/store/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import { AccountLayout, AccountOrders, AccountAddresses, AccountSecurity } from "./pages/account/Account";
import About from "./pages/About1";
import Contact from "./pages/Contact";
import { fetchCart } from "./redux/cart/cartSlice";
import { refreshMe } from "./redux/auth/authSlice";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Shop />} />
        <Route path="products/:slug" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="checkout/return" element={<CheckoutReturn />} />
        <Route path="orders/:orderNumber" element={<OrderDetail />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="auth" element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<AccountOrders />} />
            <Route path="addresses" element={<AccountAddresses />} />
            <Route path="security" element={<AccountSecurity />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </>
  )
);

export default function App() {
  const dispatch = useDispatch();
  const userId = useSelector((s) => s.auth.user?.id);
  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch, userId]);
  useEffect(() => {
    if (userId) dispatch(refreshMe());
  }, [dispatch, userId]);
  return <RouterProvider router={router} />;
}
