import dotenv from "dotenv";
dotenv.config();
import { createApp } from "./app";

async function main() {


  const app = await createApp();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});