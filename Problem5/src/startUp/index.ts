import * as db from "../lib/db"
import express from "express";
import helmet from "helmet";
import cors from "cors";
import * as errorHandler from "../lib/errorHandler";
import models from "../models";
import routes from "../routes";
import gracefulClose from "./gracefulClose";
import {init as loggerInit, requestContextMiddleware} from "../lib/customLogger"

const NODE_ENV = process.env.NODE_ENV || "dev";

export default async (app: express.Express) => {

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  
  loggerInit();
  app.use(requestContextMiddleware);
  const sequelize = db.init({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || "./data.sqlite",
    logging: (process.env.DB_LOGGING || "false").toLowerCase() === "true" ? console.log : false,
  })
  if(NODE_ENV === "dev") sequelize.sync();
  models(sequelize);

  app.get("/", (_req, res) => {
    res.json({ ok: true });
  });

  const r = routes()
  Object.keys(r).forEach((key) => {
    app.use(`/${key}`, r[key as keyof typeof routes]);
  })
  
  app.use(errorHandler.init());

  gracefulClose({
    shutdown: async () => {
      if (sequelize) await sequelize.close();
      console.log('Sequelize shutdown completed');
    },
  })

}