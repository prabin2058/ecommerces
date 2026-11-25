import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { catalogApi } from "../../api";
import ProductCard, { ProductCardSkeleton } from "../../components/store/ProductCard";

const CATEGORY_TILES = [
  { slug: "clothing", title: "Clothing", sub: "Tees, hoodies & shirts", bg: "from-indigo-100 to-indigo-50", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80&auto=format&fit=crop" },
  { slug: "electronics", title: "Electronics", sub: "Audio & wearables", bg: "from-sky-100 to-sky-50", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80&auto=format&fit=crop" },
  { slug: "home-living", title: "Home & Living", sub: "Handmade in Nepal", bg: "from-amber-100 to-amber-50", img: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80&auto=format&fit=crop" },
  { slug: "accessories", title: "Accessories", sub: "Bags, bottles & more", bg: "from-emerald-100 to-emerald-50", img: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=400&q=80&auto=format&fit=crop" },
];

function Rail({ title, query, link }) {
  const { data, loading } = useAsync(() => catalogApi.list(query), [JSON.stringify(query)]);
  return (
    <section className="container-x mt-16">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <Link to={link} className="flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
          View all <HiArrowRight />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {loading ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export default function Home() {
  useDocumentTitle("Everyday essentials, delivered");
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-brand-50">
        <div className="container-x grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="chip bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20">New season · Winter 2026</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Made well.<br />Priced fairly.<br /><span className="text-brand-600">Delivered fast.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-ink-soft">Everyday clothing, electronics and handmade home goods — shipped across Nepal with free delivery over Rs 5,000.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary btn-lg">Shop now <HiArrowRight /></Link>
              <Link to="/products?sort=newest" className="btn-outline btn-lg">New arrivals</Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-ink-muted">
              <div><b className="block text-lg text-ink">Rs 5,000+</b>free delivery</div>
              <div className="h-8 w-px bg-gray-200" />
              <div><b className="block text-lg text-ink">COD</b>cash on delivery</div>
              <div className="h-8 w-px bg-gray-200" />
              <div><b className="block text-lg text-ink">7-day</b>easy returns</div>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <img src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80&auto=format&fit=crop" alt="Heavyweight fleece hoodie" className="aspect-[4/5] w-full rounded-3xl object-cover shadow-pop" />
              <div className="mt-10 space-y-4">
                <img src="https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=700&q=80&auto=format&fit=crop" alt="Smart fitness watch" className="aspect-square w-full rounded-3xl object-cover shadow-pop" />
                <img src="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=700&q=80&auto=format&fit=crop" alt="Running sneakers" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-pop" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x mt-14">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Shop by category</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CATEGORY_TILES.map((c) => (
            <Link key={c.slug} to={`/products?category=${c.slug}`} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} p-5`}>
              <div className="relative z-10">
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-ink-soft">{c.sub}</div>
              </div>
              <img src={c.img} alt="" loading="lazy" className="ml-auto mt-2 h-28 w-28 rounded-2xl object-cover transition duration-500 group-hover:scale-105 sm:h-36 sm:w-36" />
            </Link>
          ))}
        </div>
      </section>

      <Rail title="Bestsellers" query={{ featured: "true", limit: 8 }} link="/products?sort=featured" />

      <section className="container-x mt-16">
        <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-ink p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <div className="text-sm font-semibold uppercase tracking-widest text-brand-200">First order?</div>
            <h3 className="mt-2 text-3xl font-bold">Take 10% off with code WELCOME10</h3>
            <p className="mt-2 text-gray-300">On orders over Rs 1,000. Max discount Rs 1,000.</p>
          </div>
          <div className="md:text-right">
            <Link to="/products" className="btn btn-lg bg-white text-ink hover:bg-gray-100">Start shopping <HiArrowRight /></Link>
          </div>
        </div>
      </section>

      <Rail title="New arrivals" query={{ sort: "newest", limit: 4 }} link="/products?sort=newest" />
    </>
  );
}
