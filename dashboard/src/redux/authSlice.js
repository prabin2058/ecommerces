import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi, errorMessage } from "@store/shared";

export const isStaff = (user) => !!user?.roles?.some((r) => r === "ADMIN" || r === "CATALOG_MANAGER");
export const isAdmin = (user) => !!user?.roles?.includes("ADMIN");

const finish = (data, rejectWithValue) => {
  if (!isStaff(data)) {
    authApi.logout().catch(() => {});
    return rejectWithValue("This account doesn’t have access to the admin dashboard.");
  }
  if (data.token) localStorage.setItem("authToken", data.token);
  return data;
};

export const loginUser = createAsyncThunk("auth/login", async (body, { rejectWithValue }) => {
  try {
    const data = await authApi.login(body);
    return data.twoFactorRequired ? data : finish(data, rejectWithValue);
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

export const verifyTwoFactor = createAsyncThunk("auth/2fa", async (body, { rejectWithValue }) => {
  try {
    return finish(await authApi.verify2fa(body), rejectWithValue);
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

export const refreshMe = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try {
    return await authApi.me();
  } catch (e) {
    return rejectWithValue(e.response?.status);
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await authApi.logout();
  } catch {
    /* ignore */
  }
  localStorage.removeItem("authToken");
});

const strip = ({ token, ...u }) => u; // eslint-disable-line no-unused-vars

const slice = createSlice({
  name: "auth",
  initialState: { user: null, loading: false, error: null, challenge: null },
  reducers: {
    sessionExpired: (s) => {
      s.user = null;
      localStorage.removeItem("authToken");
    },
    setUser: (s, a) => {
      s.user = a.payload ? strip(a.payload) : null;
    },
  },
  extraReducers: (b) => {
    const pending = (s) => {
      s.loading = true;
      s.error = null;
    };
    const rejected = (s, a) => {
      s.loading = false;
      s.error = a.payload || "Something went wrong";
    };
    b.addCase(loginUser.pending, pending)
      .addCase(loginUser.fulfilled, (s, { payload }) => {
        s.loading = false;
        if (payload.twoFactorRequired) s.challenge = payload.challenge;
        else s.user = strip(payload);
      })
      .addCase(loginUser.rejected, rejected)
      .addCase(verifyTwoFactor.pending, pending)
      .addCase(verifyTwoFactor.fulfilled, (s, { payload }) => {
        s.loading = false;
        s.challenge = null;
        s.user = strip(payload);
      })
      .addCase(verifyTwoFactor.rejected, rejected)
      .addCase(refreshMe.fulfilled, (s, { payload }) => {
        s.user = isStaff(payload) ? { ...s.user, ...payload } : null;
      })
      .addCase(refreshMe.rejected, (s, { payload }) => {
        if (payload === 401) s.user = null;
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
      });
  },
});

export const { sessionExpired, setUser } = slice.actions;
export default slice.reducer;
