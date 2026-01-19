import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import connectDB from "./db.js";
import logindata from "./models/logindata.js";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";

const SECRET_KEY = "MY_SECRET_KEY_123";  // Use a strong key

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// Connect to DB
connectDB();

// ===============================
// ROUTES
// ===============================

// Register new user
app.post("/register", async (req, res) => {
    try {
        const { userid, password, role } = req.body;
        if (!userid || !password || !role) {
            return res.status(400).json({ message: "Missing userid, password, or role" });
        }

        const existingUser = await logindata.findOne({ userid });
        if (existingUser) {
            return res.json({ message: "USER ID already exists!" });
        }

        const newUser = new logindata({ userid, password, role });
        await newUser.save();

        res.json({ message: "User registered successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving data" });
    }
});

// Check user login
app.post("/check-user", async (req, res) => {
    try {
        const { userid, pswd, role } = req.body;
        if (!userid || !pswd || !role) {
            return res.json({ exists: false, message: "Missing userid, password, or role" });
        }

        const user = await logindata.findOne({ userid });
        if (!user) {
            return res.json({ exists: false, message: "User does not exist" });
        }

        if (user.role !== role) {
            return res.json({ exists: false, message: `User is not ${role}` });
        }

        if (user.password !== pswd) {
            return res.json({ exists: false, message: "Incorrect password" });
        }

        // Generate JWT
        const token = jwt.sign({ userid: user.userid, role: user.role }, SECRET_KEY, { expiresIn: "30m" });

        res.json({
            exists: true,
            message: "Login successful",
            token,
            userid: user.userid,
            role: user.role
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ exists: false, message: "Server error" });
    }
});

// Example dashboard route (requires token)
app.get("/dashboard", verifyToken, async (req, res) => {
    try {
        const user = await logindata.findOne({ userid: req.user.userid });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            message: "Token valid",
            user: { userid: user.userid, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// JWT verification middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
}

// ===============================
// Start server + WebSocket
// ===============================

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("teacher_create_quiz", (quizData) => {
        console.log("Quiz Created by Teacher:", quizData);
        io.emit("send_quiz_to_students", quizData);
    });

    socket.on("send_question", (questionData) => {
        io.emit("receive_question", questionData);
    });

    socket.on("submit_answer", (answerData) => {
        console.log("Student answer:", answerData);
        io.emit("new_answer", answerData);
    });

    socket.on("student_joined", (data) => {
        console.log("Student joined:", data.userid);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server + WebSocket running at http://localhost:${PORT}`);
});
