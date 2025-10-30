import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import parkingRouter from "./routes/parkingRouter"; // path чинь таарна

const app: Application = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api", parkingRouter);

// Start server
const PORT = 9091;
server.listen(PORT, () => {
  console.log(`✅ Server is listening on port ${PORT}`);
});
