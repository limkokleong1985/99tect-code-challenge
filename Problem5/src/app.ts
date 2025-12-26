import express from "express";
import init from "./startUp";


export async function createApp(){
  const app = express()

  await init(app);

  return app;
}