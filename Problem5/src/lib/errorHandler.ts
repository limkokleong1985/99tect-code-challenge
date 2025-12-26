import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import {
  ValidationError as SequelizeValidationError,
  UniqueConstraintError
} from "sequelize";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const init = ()=>{

  return [
    notFound,
    errorHandler,
  ]
}

function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "NotFound", message: "Route not found" });
}

function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod request validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      message: "Invalid request",
      issues: err.issues
    });
  }

  // App-level errors
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: "HttpError",
      message: err.message,
      details: err.details
    });
  }

  // Sequelize model validation errors (e.g. isIn, allowNull, etc.)
  if (err instanceof SequelizeValidationError) {
    return res.status(400).json({
      error: "SequelizeValidationError",
      message: err.message,
      details: err.errors?.map((e) => ({
        message: e.message,
        path: e.path,
        value: e.value,
        validatorKey: e.validatorKey
      }))
    });
  }

  // Sequelize unique constraint errors (if you add unique fields later)
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({
      error: "SequelizeUniqueConstraintError",
      message: err.message,
      details: err.errors?.map((e) => ({
        message: e.message,
        path: e.path,
        value: e.value
      }))
    });
  }

  console.error(err);
  return res.status(500).json({
    error: "InternalServerError",
    message: "Something went wrong"
  });
}