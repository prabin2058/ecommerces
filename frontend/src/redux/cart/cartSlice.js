import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { cartApi } from "../../api";
import { errorMessage } from "@store/shared";

const wrap = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (e) {
      return rejectWithValue({ message: errorMessage(e), code: e.response?.data?.error, details: e.response?.data?.details });
    }
  });

export const fetchCart = wrap("cart/fetch", () => cartApi.get());
export const addToCart = wrap("cart/add", ({ variantId, quantity }) => cartApi.add(variantId, quantity));
export const updateQty = wrap("cart/update", ({ id, quantity }) => cartApi.update(id, quantity));
export const removeLine = wrap("cart/remove", (id) => cartApi.remove(id));
export const acceptPrice = wrap("cart/acceptPrice", (id) => cartApi.acceptPrice(id));
export const saveForLater = wrap("cart/save", (id) => cartApi.saveForLater(id));
export const moveToCart = wrap("cart/moveToCart", (variantId) => cartApi.moveToCart(variantId));
export const removeSaved = wrap("cart/removeSaved", (variantId) => cartApi.removeSaved(variantId));
export const applyCoupon = wrap("cart/coupon", (code) => cartApi.applyCoupon(code));
export const removeCoupon = wrap("cart/removeCoupon", () => cartApi.removeCoupon());

const mutations = [fetchCart, addToCart, updateQty, removeLine, acceptPrice, saveForLater, moveToCart, removeSaved, applyCoupon, removeCoupon];

const cartSlice = createSlice({
  name: "cart",
  initialState: { data: null, loaded: false, pending: 0, drawerOpen: false, lastAdded: null },
  reducers: {
    openDrawer: (s) => {
      s.drawerOpen = true;
    },
    closeDrawer: (s) => {
      s.drawerOpen = false;
    },
    setCart: (s, a) => {
      s.data = a.payload;
    },
  },
  extraReducers: (b) => {
    for (const t of mutations) {
      b.addCase(t.pending, (s) => {
        s.pending += 1;
      });
      b.addCase(t.fulfilled, (s, a) => {
        s.pending -= 1;
        s.data = a.payload;
        s.loaded = true;
        if (t === addToCart) {
          s.drawerOpen = true;
          s.lastAdded = a.meta.arg.variantId;
        }
      });
      b.addCase(t.rejected, (s) => {
        s.pending -= 1;
        s.loaded = true;
      });
    }
  },
});

export const { openDrawer, closeDrawer, setCart } = cartSlice.actions;
export default cartSlice.reducer;
