import { Request, Response, Router } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { checkToken } from '../middleware/checkUserToken';
import dotenv from 'dotenv';
import { generateTokens } from '../utils/jwt';

dotenv.config();

const router = Router();

router.put('/profile', checkToken, async (req: any, res: Response): Promise<any> => {
    const { name, email, mobile, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
    }

    // Validate mobile if provided
    if (mobile && !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Mobile number must be 10 digits' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email is being changed and if it's already taken
        if (email !== user.email) {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        // Prepare update data
        const updateData: any = {
            name,
            email,
            mobile: mobile || null,
        };

        // If user wants to change password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password' });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            // Hash new password
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                mobile: updatedUser.mobile,
            },
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE USER ACCOUNT
// DELETE USER ACCOUNT (Updated with cascade deletion)
router.delete('/account', checkToken, async (req: any, res: Response): Promise<any> => {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: 'Password is required to delete account' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                projects: true,           // Projects as buyer
                assignedProjects: true,   // Projects as seller
                bids: true,
                deliverables: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify password before deletion
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        // Use a transaction to delete everything in the correct order
        await prisma.$transaction(async (tx: any) => {
            // 1. Delete deliverables submitted by this user
            await tx.deliverable.deleteMany({
                where: { sellerId: userId }
            });

            // 2. Delete bids made by this user
            await tx.bid.deleteMany({
                where: { sellerId: userId }
            });

            // 3. Handle projects where user is seller (unassign them)
            await tx.project.updateMany({
                where: { sellerId: userId },
                data: {
                    sellerId: null,
                    status: 'PENDING' // Reset status back to pending
                }
            });

            // 4. Delete projects created by this user (as buyer)
            // First delete deliverables for these projects
            const userProjects = await tx.project.findMany({
                where: { buyerId: userId },
                select: { id: true }
            });

            const projectIds = userProjects.map((p: any) => p.id);

            if (projectIds.length > 0) {
                // Delete deliverables for these projects
                await tx.deliverable.deleteMany({
                    where: { projectId: { in: projectIds } }
                });

                // Delete bids for these projects
                await tx.bid.deleteMany({
                    where: { projectId: { in: projectIds } }
                });

                // Now delete the projects
                await tx.project.deleteMany({
                    where: { buyerId: userId }
                });
            }

            // 5. Finally, delete the user
            await tx.user.delete({
                where: { id: userId }
            });
        });

        // Clear cookies
        res.clearCookie('refreshToken');
        res.clearCookie('accessToken');

        res.status(200).json({ message: 'Account and all associated data deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ message: 'Failed to delete account. Please try again.' });
    }
});
// Register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
    const { name, email, password, role, mobile } = req.body; // Added mobile

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Validate mobile if provided (optional validation)
    if (mobile && !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Mobile number must be 10 digits' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                mobile: mobile || null // Optional mobile field
            },
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mobile: user.mobile,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login (unchanged)
router.post('/login', async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return res.status(401).json({ message: 'Email is not registered' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid password' });

        const payload = { id: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken } = generateTokens(payload);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.cookie('accessToken', accessToken, {
            httpOnly: false,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            message: 'Login successful',
            accessToken,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Refresh token route (unchanged)
router.post('/token', async (req: Request, res: Response): Promise<any> => {
    const cookies = req.cookies;

    if (!cookies?.refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    const refreshToken = cookies.refreshToken;

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const payload = { id: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({ accessToken });
    } catch (err) {
        console.error('Refresh error:', err);
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
});

// Get current user (updated to include mobile)
router.get('/me', checkToken, async (req: any, res: Response): Promise<any> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json({
            message: 'User found',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mobile: user.mobile, // Include mobile
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout (unchanged)
router.post('/logout', async (req: Request, res: Response): Promise<any> => {
    try {
        const cookies = req.cookies;

        if (cookies?.refreshToken) {
            const decoded = jwt.verify(cookies.refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;

            await prisma.user.update({
                where: { id: decoded.id },
                data: { refreshToken: null },
            });
        }

        res.clearCookie('refreshToken');
        res.clearCookie('accessToken');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to logout' });
    }
});

export default router;