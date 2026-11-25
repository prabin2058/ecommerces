import { configureStore } from "@reduxjs/toolkit";
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "./rootReducer";

// Only the signed-in user is persisted locally; the cart lives on the server.
const persistedReducer = persistReducer({ key: "root", version: 2, storage, whitelist: ["auth"] }, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (gdm) => gdm({ serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] } }),
});

export const persistor = persistStore(store);
