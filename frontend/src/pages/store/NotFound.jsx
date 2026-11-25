import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-7xl font-extrabold tracking-tight text-gray-200">404</div>
      <h1 className="mt-4 text-2xl font-bold">We couldn’t find that page</h1>
      <p className="mt-2 text-ink-muted">It may have moved, or the product is no longer available.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-outline">Go home</Link>
        <Link to="/products" className="btn-primary">Browse products</Link>
      </div>
    </div>
  );
}
