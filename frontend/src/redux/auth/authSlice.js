import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "../../api";
import { errorMessage } from "@store/shared";
import { fetchCart } from "../cart/cartSlice";

const saveToken = (data) => {
  if (data?.token) localStorage.setItem("authToken", data.token);
};

export const loginUser = createAsyncThunk("auth/login", async (body, { rejectWithValue, dispatch }) => {
  try {
    const data = await authApi.login(body);
    if (data.twoFactorRequired) return data;
    saveToken(data);
    dispatch(fetchCart()); // guest cart was merged server-side
    return data;
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

export const verifyTwoFactor = createAsyncThunk("auth/2fa", async (body, { rejectWithValue, dispatch }) => {
  try {
    const data = await authApi.verify2fa(body);
    saveToken(data);
    dispatch(fetchCart());
    return data;
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

export const registerUser = createAsyncThunk("auth/register", async (body, { rejectWithValue, dispatch }) => {
  try {
    const data = await authApi.register(body);
    saveToken(data);
    dispatch(fetchCart());
    return data;
  } catch (e) {
    return rejectWithValue({ message: errorMessage(e), details: e.response?.data?.details });
  }
});

export const refreshMe = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try {
    return await authApi.me();
  } catch (e) {
    return rejectWithValue(e.response?.status);
  }
});

export const logout = createAsyncThunk("auth/logout", async (_, { dispatch }) => {
  try {
    await authApi.logout();
  } catch {
    /* ignore */
  }
  localStorage.removeItem("authToken");
  dispatch(fetchCart());
});

const strip = ({ token, ...u }) => u; // eslint-disable-line no-unused-vars

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, loading: false, error: null, challenge: null },
  reducers: {
    sessionExpired: (state) => {
      state.user = null;
      localStorage.removeItem("authToken");
    },
    setUser: (state, action) => {
      state.user = action.payload ? strip(action.payload) : null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    const pending = (state) => {
      state.loading = true;
      state.error = null;
    };
    const rejected = (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || action.payload || "Something went wrong";
    };
    b.addCase(loginUser.pending, pending)
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (payload.twoFactorRequired) state.challenge = payload.challenge;
        else {
          state.user = strip(payload);
          state.challenge = null;
        }
      })
      .addCase(loginUser.rejected, rejected)
      .addCase(verifyTwoFactor.pending, pending)
      .addCase(verifyTwoFactor.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = strip(payload);
        state.challenge = null;
      })
      .addCase(verifyTwoFactor.rejected, rejected)
      .addCase(registerUser.pending, pending)
      .addCase(registerUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = strip(payload);
      })
      .addCase(registerUser.rejected, rejected)
      .addCase(refreshMe.fulfilled, (state, { payload }) => {
        state.user = payload;
      })
      .addCase(refreshMe.rejected, (state, { payload }) => {
        if (payload === 401) state.user = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { sessionExpired, setUser, clearAuthError } = authSlice.actions;
export const isStaff = (user) => !!user?.roles?.some((r) => r === "ADMIN" || r === "CATALOG_MANAGER");
export const isAdmin = (user) => !!user?.roles?.includes("ADMIN");
export default authSlice.reducer;
