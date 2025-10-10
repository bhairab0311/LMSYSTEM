import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { data } from "react-router-dom";
import { toast } from "react-toastify";
import { toggleAddNewAdminPopup } from "./popUpSlice";

const userSlice = createSlice({
  name: "user",
  initialState: {
    loading: false,
    users: [], // for admin — all users
  },
  reducers: {
    fetchAllUsersRequest(state) {
      state.loading = true;
    },
    fetchAllUsersSuccess(state, action) {
      state.loading = false;
      state.users = action.payload;
    },
    fetchAllUsersFailed(state) {
      state.loading = false;
    },
    addNewAdminRequest(state) {
      state.loading = true;
    },
    addNewAdminRequest(state) {
      state.loading = false;
    },
    addNewAdminFailed(state) {
      state.loading = false;
    },
  },
});

export const fetchAllUsers = () => async (dispatch) => {
  dispatch(userSlice.actions.fetchAllUsersRequest());
  await axios
    .get("http://localhost:4000/api/v1/user/all", { withCredentials: true })
    .then((res) => {
      dispatch(userSlice.actions.fetchAllUsersSuccess(res.data.users));
    })
    .catch((err) => {
      dispatch(
        userSlice.actions.fetchAllUsersFailed(err.response.data.message)
      );
    });
};

export const addNewAdmin = (data) => async (dispatch) => {
  dispatch(userSlice.actions.addNewAdminRequest());
  await axios
    .post("http://localhost:4000/api/v1/user/add/new-admin", data, {
      withCredentials: true,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    .then((res) => {
      dispatch(userSlice.actions.addNewAdminRequest());
      toast.success(res.data.message || "admin added successfully");
      dispatch(toggleAddNewAdminPopup());
    })
    .catch((err) => {
      userSlice.actions.addNewAdminFailed();
      toast.error(err.response.data.message);
    });
};

export default userSlice.reducer;
