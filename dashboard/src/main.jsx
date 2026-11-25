import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { setUnauthorizedHandler } from "@store/shared";
import App from "./App.jsx";
import "./index.css";
import { persistor, store } from "./redux/store.js";
import { sessionExpired } from "./redux/authSlice";

setUnauthorizedHandler(() => {
  if (store.getState().auth.user) store.dispatch(sessionExpired());
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
        <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar newestOnTop theme="dark" toastClassName="!rounded-xl !text-sm" />
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
