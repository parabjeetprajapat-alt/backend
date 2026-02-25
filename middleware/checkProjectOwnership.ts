import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export async function checkProjectOwnership(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = Number(req.params.id);

  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return;
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    if (project.buyerId !== req.user?.id) {
      res.status(403).json({ message: 'You are not the owner of this project' });
      return;
    }

    next(); // ✅ All checks passed
  } catch (err) {
    console.error('checkProjectOwnership error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
