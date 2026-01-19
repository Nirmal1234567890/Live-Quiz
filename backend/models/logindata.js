
import mongoose from "mongoose";

const logindataSchema = new mongoose.Schema({
  userid: String,
  password: String,
  role: { type: String, enum: ["student", "teacher", "admin"], default: "student" } 
});

export default mongoose.model("logindata", logindataSchema);