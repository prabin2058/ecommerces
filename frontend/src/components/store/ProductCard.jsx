import { Link } from "react-router-dom";
import { Badge, Price, ProductImage } from "@store/shared";
import { discountPct, money, srcSetFor } from "@store/shared";

export default function ProductCard({ product: p }) {
  const off = discountPct(p.priceMin, p.compareAtPrice);
  return (
    <Link to={`/products/${p.slug}`} className="group block" aria-label={p.name}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100">
        <ProductImage src={p.image} alt={p.imageAlt} className="transition duration-500 group-hover:scale-[1.03]" />
        {p.hoverImage && (
          <img src={p.hoverImage} srcSet={srcSetFor(p.hoverImage)} sizes="(min-width: 768px) 25vw, 50vw" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {!p.inStock && <Badge tone="dark">Sold out</Badge>}
          {p.inStock && off > 0 && <Badge tone="red" className="!bg-white">−{off}%</Badge>}
          {p.inStock && p.lowStock && <Badge tone="yellow" className="!bg-white">Almost gone</Badge>}
        </div>
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        {p.brand && <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{p.brand}</div>}
        <h3 className="line-clamp-2 text-sm font-medium text-ink group-hover:underline group-hover:underline-offset-4">{p.name}</h3>
        <div className="flex items-baseline gap-2">
          {p.priceMax && p.priceMax !== p.priceMin ? (
            <span className="text-sm font-semibold">From {money(p.priceMin)}</span>
          ) : (
            <Price price={p.priceMin} compareAt={p.compareAtPrice} size="sm" />
          )}
        </div>
        {p.variantCount > 1 && <div className="text-xs text-ink-muted">{p.variantCount} options</div>}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100" />
      <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
      <div className="mt-2 h-4 w-1/4 animate-pulse rounded bg-gray-100" />
    </div>
  );
}
