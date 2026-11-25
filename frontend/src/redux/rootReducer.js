import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import cartReducer from "./cart/cartSlice";

export default combineReducers({ auth: authReducer, cart: cartReducer });
