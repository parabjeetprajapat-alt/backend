import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/authRoute';
import projectRoutes from './routes/projectRoutes';
import bidRoutes from './routes/bidRoutes';
import deliverableRoute from './routes/deliverableRoutes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();

// 1. Get origin from Environment Variable
const FRONT_END_URL = process.env.FRONT_END_URL;

const corsOptions = {
    origin: (origin: string | undefined, callback: any) => {
        // Allow if no origin (server-to-server) or if it matches our ENV variable
        if (!origin || origin === FRONT_END_URL) {
            callback(null, true);
        } else {
            console.error(`CORS Blocked: ${origin} does not match ${FRONT_END_URL}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

// 2. Middleware setup
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
const uploadsDir = path.join(process.cwd(), 'uploads');
const bidVideosDir = path.join(process.cwd(), 'uploads/bid-videos');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(bidVideosDir)) {
    fs.mkdirSync(bidVideosDir, { recursive: true });
}

// 3. Manual Preflight check for Express 5 compatibility
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', FRONT_END_URL);
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.sendStatus(200);
    }
    next();
});

// 4. Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS Configured for: ${FRONT_END_URL}`);
});