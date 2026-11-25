import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineShoppingBag } from "react-icons/hi2";
import { closeDrawer } from "../../redux/cart/cartSlice";
import { Drawer, EmptyState, Button } from "@store/shared";
import CartLine from "./CartLine";
import FreeShippingBar from "./FreeShippingBar";
import { money } from "@store/shared";

export default function MiniCart() {
  const { data: cart, drawerOpen, pending } = useSelector((s) => s.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const close = () => dispatch(closeDrawer());
  const items = cart?.items || [];
  const go = (to) => {
    close();
    navigate(to);
  };
  return (
    <Drawer open={drawerOpen} onClose={close} title={`Your cart${cart?.itemCount ? ` (${cart.itemCount})` : ""}`}
      footer={items.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Subtotal</span>
            <span className="font-semibold">{money(cart.subtotal)}</span>
          </div>
          {cart.discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Discount ({cart.coupon?.code})</span>
              <span>−{money(cart.discount)}</span>
            </div>
          )}
          <p className="text-xs text-ink-muted">Shipping and taxes calculated at checkout.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => go("/cart")}>View cart</Button>
            <Button onClick={() => go("/checkout")} disabled={!cart.canCheckout || pending > 0}>Checkout</Button>
          </div>
          {!cart.canCheckout && <p className="text-center text-xs font-medium text-red-600">Fix the highlighted items to check out.</p>}
        </div>
      )}>
      {items.length === 0 ? (
        <EmptyState icon={HiOutlineShoppingBag} title="Your cart is empty" action={<Button onClick={() => go("/products")}>Start shopping</Button>}>
          Find something you love — it’ll be saved here, even if you close the tab.
        </EmptyState>
      ) : (
        <div className="px-5">
          <div className="pt-4">
            <FreeShippingBar freeShipping={cart.freeShipping} />
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((i) => <CartLine key={i.id} item={i} compact />)}
          </div>
          <Link to="/cart" onClick={close} className="link mb-4 block text-sm">Have a coupon? Apply it in your cart</Link>
        </div>
      )}
    </Drawer>
  );
}
