import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

interface DecodedToken {
  id: number;
  email: string;
  role: 'BUYER' | 'SELLER';
}

// Middleware to check access token
export function checkToken(
  req: Request & { user?: DecodedToken },
  res: Response,
  next: NextFunction
): void | any {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

// Middleware to check user role
export function authorizeRole(role: 'BUYER' | 'SELLER') {
  return (
    req: Request & { user?: DecodedToken },
    res: Response,
    next: NextFunction
  ): any => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: 'Access forbidden: wrong role' });
    }
    next();
  };
}
