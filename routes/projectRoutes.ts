import dotenv from 'dotenv';
import Router from 'express';
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import { prisma } from '../prisma';
dotenv.config();
const router = Router();

// Valid project status values for validation
const ValidStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

interface Project {
  id: number;
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  deadline: Date;
  buyerId: number;
  status: string;
  department: string; // NEW
}

// Create project (UPDATED with department)
router.post(
  '/projects',
  checkToken,
  authorizeRole('BUYER'),
  async (req: Request & { user?: any }, res: Response): Promise<any> => {
    const { title, description, budgetMin, budgetMax, deadline, department } = req.body;

    // Input validation (UPDATED)
    if (!title || !description || !budgetMin || !budgetMax || !deadline || !department) {
      return res.status(400).json({ message: 'Please fill all fields including department' });
    }

    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized: Missing user ID' });
      }

      const project = await prisma.project.create({
        data: {
          title,
          description,
          budgetMin: parseFloat(budgetMin),
          budgetMax: parseFloat(budgetMax),
          deadline: new Date(deadline),
          department, // NEW
          buyerId: req.user.id,
        },
      });

      return res.status(201).json({
        message: 'Project created successfully',
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          budgetMin: project.budgetMin,
          budgetMax: project.budgetMax,
          deadline: project.deadline,
          department: project.department, // NEW
          buyerId: project.buyerId,
        },
      });
    } catch (error: any) {
      console.error('Error creating project:', error.message, error.stack);
      return res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
);

// Get buyer's projects (UPDATED with sorting and filtering)
router.get('/projects', checkToken, async (req: any, res: Response): Promise<any> => {
  const { sortBy = 'createdAt', order = 'desc', department, status } = req.query;

  try {
    // Build filter conditions
    const where: any = {
      buyerId: req.user?.id
    };

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Build sort options
    let orderBy: any = {};
    if (sortBy === 'budget') {
      orderBy.budgetMax = order;
    } else if (sortBy === 'deadline') {
      orderBy.deadline = order;
    } else if (sortBy === 'title') {
      orderBy.title = order;
    } else {
      orderBy.createdAt = order;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy
    });

    const projectData = projects.map((project: Project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budgetMin: project.budgetMin,
      budgetMax: project.budgetMax,
      deadline: project.deadline,
      status: project.status,
      department: project.department // NEW
    }));

    res.status(200).json({
      message: 'Projects fetched successfully',
      project: projectData
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get open projects for sellers (UPDATED with sorting and filtering)
router.get('/projects/open', checkToken, authorizeRole('SELLER'), async (req: Request, res: Response): Promise<any> => {
  const { sortBy = 'createdAt', order = 'desc', department } = req.query;

  try {
    // Build filter
    const where: any = {
      sellerId: null,
      status: 'PENDING',
    };

    if (department && department !== 'ALL') {
      where.department = department;
    }

    // Build sort
    let orderBy: any = {};
    if (sortBy === 'budget') {
      orderBy.budgetMax = order;
    } else if (sortBy === 'deadline') {
      orderBy.deadline = order;
    } else if (sortBy === 'title') {
      orderBy.title = order;
    } else {
      orderBy.createdAt = order;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy
    });

    const openProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budgetMin: project.budgetMin,
      budgetMax: project.budgetMax,
      deadline: project.deadline ? project.deadline.toISOString().split('T')[0] : null,
      status: project.status,
      department: project.department, // NEW
    }));

    res.status(200).json(openProjects);
  } catch (error) {
    console.error("Error in /projects/open:", error);
    res.status(500).json({
      message: 'Failed to fetch open projects',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get seller's assigned projects (UPDATED with sorting)
router.get('/projects/my', checkToken, authorizeRole('SELLER'), async (req: any, res: Response): Promise<any> => {
  const { sortBy = 'createdAt', order = 'desc', department, status } = req.query;

  try {
    const where: any = {
      sellerId: Number(req.user.id)
    };

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    let orderBy: any = {};
    if (sortBy === 'budget') {
      orderBy.budgetMax = order;
    } else if (sortBy === 'deadline') {
      orderBy.deadline = order;
    } else if (sortBy === 'title') {
      orderBy.title = order;
    } else {
      orderBy.createdAt = order;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy
    });

    const myProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budgetMin: project.budgetMin,
      budgetMax: project.budgetMax,
      deadline: project.deadline.toISOString().split('T')[0],
      status: project.status,
      department: project.department,
    }));

    res.status(200).json(myProjects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch seller projects', error });
  }
});


// GET: Single project details
router.get('/projects/:id', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (isNaN(projectId)) return res.status(400).json({ message: 'Invalid ID' });

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { deliverable: true }
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.status(200).json({ message: 'Project fetched successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT: Update project or Assign Seller
router.put('/projects/:id', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (isNaN(projectId)) return res.status(400).json({ message: 'Invalid ID' });

  try {
    // Logic for assigning a seller
    if (req.body.sellerId) {
      const sellerId = Number(req.body.sellerId);
      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          sellerId: sellerId,
          status: 'IN_PROGRESS',
        },
      });

      const seller = await prisma.user.findUnique({ where: { id: sellerId } });

      if (seller?.email) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.MAIL_SENDER_EMAIL,
              pass: process.env.MAIL_SENDER_PASSWORD,
            },
          });

          await transporter.sendMail({
            from: `"Project Team" <${process.env.MAIL_SENDER_EMAIL}>`,
            to: seller.email,
            subject: '🎉 Project Selected!',
            html: `<h2>Hello ${seller.name},</h2><p>You have been selected for: ${updatedProject.title}</p>`,
          });
        } catch (emailError) {
          console.error('Failed to send selection email:', emailError);
          // Don't throw error here, so the project assignment still succeeds
        }
      }

      return res.status(200).json({ message: 'Seller selected successfully', project: updatedProject });
    }

    // Logic for updating project details
    const { title, description, budgetMin, budgetMax, deadline } = req.body;
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        title,
        description,
        budgetMin: budgetMin ? Math.round(parseFloat(budgetMin)) : undefined,
        budgetMax: budgetMax ? Math.round(parseFloat(budgetMax)) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      }
    });

    return res.status(200).json({ message: 'Project updated successfully', project });
  } catch (error: any) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// DELETE: Delete project
router.delete('/projects/:id', checkToken, authorizeRole('BUYER'), async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);

  if (isNaN(projectId)) {
    return res.status(400).json({ message: 'Invalid ID' });
  }

  try {
    // Delete in transaction to ensure all-or-nothing
    await prisma.$transaction(async (tx: any) => {
      // Delete all bids related to this project
      await tx.bid.deleteMany({
        where: { projectId }
      });

      // Delete deliverable if exists
      await tx.deliverable.deleteMany({
        where: { projectId }
      });

      // Finally delete the project
      await tx.project.delete({
        where: { id: projectId }
      });
    });

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});
// PUT: Update Status specifically
router.put('/projects/:id/status', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  const { status } = req.body;

  if (!ValidStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { status }
    });
    res.status(200).json({ message: 'Status updated', project });
  } catch (error: any) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;