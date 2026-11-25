import { Link } from "react-router-dom";
import { HiOutlineTruck, HiOutlineShieldCheck, HiOutlineArrowPath, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";

const perks = [
  { icon: HiOutlineTruck, title: "Fast delivery", text: "Next-day in Kathmandu valley" },
  { icon: HiOutlineShieldCheck, title: "Secure payments", text: "Card, wallet, bank or COD" },
  { icon: HiOutlineArrowPath, title: "Easy returns", text: "7-day hassle-free returns" },
  { icon: HiOutlineChatBubbleLeftRight, title: "Real support", text: "Sun–Fri, 9am–6pm" },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-200 bg-gray-50">
      <div className="container-x grid grid-cols-2 gap-6 border-b border-gray-200 py-10 md:grid-cols-4">
        {perks.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <Icon className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-ink-muted">{text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="container-x grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-lg font-bold">Prabin<span className="text-brand-600">.</span></div>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">Everyday essentials, thoughtfully made — shipped from Kathmandu across Nepal.</p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Shop</div>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link to="/products" className="hover:text-ink">All products</Link></li>
            <li><Link to="/products?category=clothing" className="hover:text-ink">Clothing</Link></li>
            <li><Link to="/products?category=electronics" className="hover:text-ink">Electronics</Link></li>
            <li><Link to="/products?category=home-living" className="hover:text-ink">Home &amp; Living</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Help</div>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link to="/account" className="hover:text-ink">Track an order</Link></li>
            <li><Link to="/contact" className="hover:text-ink">Contact us</Link></li>
            <li><Link to="/about" className="hover:text-ink">About</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">We accept</div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-soft">
            {["Visa", "Mastercard", "eSewa", "Khalti", "Bank", "COD"].map((m) => (
              <span key={m} className="rounded-md border border-gray-200 bg-white px-2 py-1">{m}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200 py-5 text-center text-xs text-ink-muted">© {new Date().getFullYear()} Prabin Store. All rights reserved. · Product photos from <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline hover:text-ink">Unsplash</a></div>
    </footer>
  );
}
