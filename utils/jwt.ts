import jwt from 'jsonwebtoken';

export const generateTokens = (payload: object) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '1h',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: '7d', 
  });

  return { accessToken, refreshToken };
};