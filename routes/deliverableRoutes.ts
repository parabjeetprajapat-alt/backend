import { Request, Response, Router } from "express";
import { prisma } from "../prisma";
import { checkProjectOwnership } from "../middleware/checkProjectOwnership";
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import upload from '../middleware/upload';

const router = Router();

// Updated to handle three separate files
router.post('/projects/:id/deliverables',
    checkToken,
    authorizeRole('SELLER'),
    upload.fields([
        { name: 'pdf', maxCount: 1 },      // PDF file
        { name: 'zip', maxCount: 1 },      // ZIP file
        { name: 'video', maxCount: 1 }     // Video file
    ]),
    async (req: Request, res: Response): Promise<any> => {
        const projectId = parseInt(req.params.id);
        const sellerId = (req as any).user.id;
        const { pdfLink, zipLink, videoLink } = req.body;
        
        let pdfUrl = null;
        let zipUrl = null;
        let videoUrl = null;

        const files = (req as any).files;

        // Handle PDF file
        if (files?.pdf && files.pdf[0]) {
            pdfUrl = `/uploads/${files.pdf[0].filename}`;
        }

        // Handle ZIP file
        if (files?.zip && files.zip[0]) {
            zipUrl = `/uploads/${files.zip[0].filename}`;
        }

        // Handle Video file
        if (files?.video && files.video[0]) {
            videoUrl = `/uploads/${files.video[0].filename}`;
        }

        // Check if at least one file or link is provided
        if (!pdfUrl && !zipUrl && !videoUrl && !pdfLink && !zipLink && !videoLink) {
            return res.status(400).json({ error: 'Please upload at least one file or provide a link.' });
        }

        try {
            // Ensure seller is assigned to this project
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: { seller: true }
            });

            if (!project || project.sellerId !== sellerId) {
                return res.status(403).json({ error: 'You are not authorized to upload for this project.' });
            }

            const deliverable = await prisma.deliverable.create({
                data: {
                    projectId,
                    sellerId,
                    pdfUrl,
                    zipUrl,
                    videoUrl,
                    pdfLink: pdfLink || null,
                    zipLink: zipLink || null,
                    videoLink: videoLink || null
                }
            });

            res.status(201).json({ message: 'Deliverable uploaded successfully', deliverable });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Something went wrong.' });
        }
    }
);

router.get('/projects/:id/deliverables', 
    checkToken, 
    authorizeRole('BUYER'), 
    checkProjectOwnership, 
    async (req: Request, res: Response): Promise<any> => {
        const projectId = parseInt(req.params.id);

        try {
            const deliverable = await prisma.deliverable.findFirst({
                where: { projectId },
                select: {
                    id: true,
                    pdfUrl: true,
                    zipUrl: true,
                    videoUrl: true,
                    pdfLink: true,
                    zipLink: true,
                    videoLink: true,
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (!deliverable) {
                return res.status(404).json({ error: 'No deliverables found for this project.' });
            }

            return res.status(200).json({ deliverable });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch deliverables.' });
        }
    }
);

export default router;