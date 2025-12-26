import { Router } from "express";
import { z } from "zod";
import { Op, WhereOptions } from "sequelize";
import { Resource } from "../models/resource/Resource";
import { HttpError } from "../lib/errorHandler";

export const resourcesRouter = Router();

const ResourceResponse = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

function toResponse(row: Resource) {
  const plain = row.get({ plain: true }) as any;

  const payload = {
    ...plain,
    createdAt: new Date(plain.createdAt).toISOString(),
    updatedAt: new Date(plain.updatedAt).toISOString()
  };

  return ResourceResponse.parse(payload);
}

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "archived"]).optional()
});

const UpdateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional()
});

const ListQuery = z.object({
  status: z.enum(["active", "archived"]).optional(),
  q: z.string().min(1).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

// Create
resourcesRouter.post("/", async (req, res, next) => {
  try {
    const body = CreateBody.parse(req.body);

    const created = await Resource.create({
      name: body.name,
      description: body.description ?? null,
      status: body.status ?? "active"
    });

    return res.status(201).json(toResponse(created));
  } catch (e) {
    next(e);
  }
});

// List with basic filters
resourcesRouter.get("/", async (req, res, next) => {
  try {
    const query = ListQuery.parse(req.query);

    const where: WhereOptions = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      
      where.name = { [Op.like]: `%${query.q}%` };
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) (where.createdAt as any)[Op.gte] = query.createdFrom;
      if (query.createdTo) (where.createdAt as any)[Op.lte] = query.createdTo;
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const { rows, count } = await Resource.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset
    });

    return res.json({
      data: rows.map(toResponse),
      limit,
      offset,
      count
    });
  } catch (e) {
    next(e);
  }
});

// Get details
resourcesRouter.get("/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);

    const row = await Resource.findByPk(id);
    if (!row) throw new HttpError(404, "Resource not found");

    return res.json(toResponse(row));
  } catch (e) {
    next(e);
  }
});

// Update (PATCH)
resourcesRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = UpdateBody.parse(req.body);

    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "No fields provided to update");
    }

    const row = await Resource.findByPk(id);
    if (!row) throw new HttpError(404, "Resource not found");

    if (body.name !== undefined) row.name = body.name;
    if (body.description !== undefined) row.description = body.description;
    if (body.status !== undefined) row.status = body.status;

    await row.save();

    return res.json(toResponse(row));
  } catch (e) {
    next(e);
  }
});

// Delete
resourcesRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);

    const deleted = await Resource.destroy({ where: { id } });
    if (deleted === 0) throw new HttpError(404, "Resource not found");

    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});