import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 doesn't catch a rejected promise from an async handler on its
 * own — it would otherwise hang the request or crash the process. This routes
 * the rejection to Express's error pipeline instead.
 */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
