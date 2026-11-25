import { lazy, Suspense, useEffect } from "react";
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { PageLoader } from "@store/shared";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/Login";
import { refreshMe } from "./redux/authSlice";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const ProductEditor = lazy(() => import("./pages/ProductEditor"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Categories = lazy(() => import("./pages/Categories"));
const Coupons = lazy(() => import("./pages/Coupons"));
const ImportExport = lazy(() => import("./pages/ImportExport"));
const Activity = lazy(() => import("./pages/Activity"));
const Users = lazy(() => import("./pages/Users"));
const Security = lazy(() => import("./pages/Security"));

const S = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

function RequireStaff() {
  const user = useSelector((s) => s.auth.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function GuestOnly() {
  const user = useSelector((s) => s.auth.user);
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<RequireStaff />}>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={S(<Dashboard />)} />
          <Route path="products" element={S(<Products />)} />
          <Route path="products/:id" element={S(<ProductEditor />)} />
          <Route path="orders" element={S(<Orders />)} />
          <Route path="orders/:id" element={S(<OrderDetail />)} />
          <Route path="inventory" element={S(<Inventory />)} />
          <Route path="categories" element={S(<Categories />)} />
          <Route path="coupons" element={S(<Coupons />)} />
          <Route path="import" element={S(<ImportExport />)} />
          <Route path="activity" element={S(<Activity />)} />
          <Route path="users" element={S(<Users />)} />
          <Route path="security" element={S(<Security />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </>
  )
);

export default function App() {
  const dispatch = useDispatch();
  const userId = useSelector((s) => s.auth.user?.id);
  useEffect(() => {
    if (userId) dispatch(refreshMe());
  }, [dispatch, userId]);
  return <RouterProvider router={router} />;
}
